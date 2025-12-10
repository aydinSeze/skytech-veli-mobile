'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * Supabase Storage'da 'backups' bucket'ının var olup olmadığını kontrol eder
 * Yoksa service role key ile oluşturmaya çalışır
 */
async function ensureBackupBucket() {
    const supabase = await createClient()

    try {
        // Bucket'ı kontrol et
        const { data: buckets, error: listError } = await supabase.storage.listBuckets()

        if (listError) {
            console.error('Bucket listesi alınırken hata:', listError)
            // Listeleme başarısız olursa, bucket'ı varsayarak devam et
            return { success: true, bucketExists: false, message: 'Bucket kontrolü yapılamadı, varsayılan olarak devam ediliyor.' }
        }

        // 'backups' bucket'ı var mı kontrol et
        const backupBucket = buckets?.find(b => b.name === 'backups')

        if (backupBucket) {
            return { success: true, bucketExists: true, bucket: backupBucket }
        }

        // Bucket yoksa, service role key ile oluşturmayı dene
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            try {
                const supabaseAdmin = createAdminClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!,
                    {
                        auth: {
                            autoRefreshToken: false,
                            persistSession: false
                        }
                    }
                )

                const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket('backups', {
                    public: false, // Yedekler private olmalı
                    fileSizeLimit: 104857600, // 100 MB limit
                    allowedMimeTypes: ['application/json']
                })

                if (createError) {
                    console.warn('Bucket oluşturulamadı:', createError)
                    return {
                        success: false,
                        bucketExists: false,
                        error: 'backups bucket bulunamadı ve oluşturulamadı. Lütfen Supabase Dashboard\'dan manuel olarak oluşturun: Storage -> New bucket -> Name: "backups", Public: false',
                        needsManualSetup: true
                    }
                }

                return { success: true, bucketExists: true, bucket: newBucket, message: 'Backups bucket başarıyla oluşturuldu.' }
            } catch (adminError: any) {
                console.warn('Service role key ile bucket oluşturma hatası:', adminError)
            }
        }

        // Service role key yoksa veya oluşturma başarısız olursa
        // Service role key yoksa veya oluşturma başarısız olursa
        // Bucket var ama listelenemiyor olabilir (RLS yüzünden). Hatayı yut ve devam et.
        console.warn('Backups bucket listede bulunamadı, ancak var olduğu varsayılarak devam ediliyor.')
        return {
            success: true,
            bucketExists: false,
            message: 'Bucket kontrolü: Listede görünmüyor, varsayılan olarak devam ediliyor.'
        }
    } catch (error: any) {
        console.error('Bucket kontrolü hatası:', error)
        // Hata durumunda varsayılan olarak devam et
        return { success: true, bucketExists: false, message: 'Bucket kontrolü yapılamadı, varsayılan olarak devam ediliyor.' }
    }
}

/**
 * Son yedekleme tarihini system_settings tablosundan alır
 */
async function getLastBackupDate(): Promise<string | null> {
    const supabase = await createClient()

    try {
        const { data, error } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'last_backup_date')
            .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Son yedekleme tarihi alınırken hata:', error)
            return null
        }

        return data?.setting_value || null
    } catch (error) {
        console.error('Son yedekleme tarihi hatası:', error)
        return null
    }
}

/**
 * Son yedekleme tarihini system_settings tablosuna kaydeder
 */
async function setLastBackupDate(date: string) {
    const supabase = await createClient()

    try {
        // Önce var mı kontrol et
        const { data: existing } = await supabase
            .from('system_settings')
            .select('id')
            .eq('setting_key', 'last_backup_date')
            .single()

        if (existing) {
            // Güncelle
            const { error } = await supabase
                .from('system_settings')
                .update({ setting_value: date })
                .eq('setting_key', 'last_backup_date')

            if (error) {
                console.error('Yedekleme tarihi güncellenirken hata:', error)
                return { success: false, error: error.message }
            }
        } else {
            // Yeni ekle
            const { error } = await supabase
                .from('system_settings')
                .insert({
                    setting_key: 'last_backup_date',
                    setting_value: date,
                    description: 'Son otomatik yedekleme tarihi (YYYY-MM-DD formatında)'
                })

            if (error) {
                console.error('Yedekleme tarihi eklenirken hata:', error)
                return { success: false, error: error.message }
            }
        }

        return { success: true }
    } catch (error: any) {
        console.error('Yedekleme tarihi kaydedilirken hata:', error)
        return { success: false, error: error.message || 'Bilinmeyen hata' }
    }
}

/**
 * Bugün yedekleme yapılmış mı kontrol eder
 */
export async function shouldRunBackup(): Promise<{ shouldRun: boolean; lastBackupDate: string | null }> {
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD formatında
    const lastBackupDate = await getLastBackupDate()

    if (!lastBackupDate) {
        // Hiç yedekleme yapılmamış
        return { shouldRun: true, lastBackupDate: null }
    }

    // Bugün yedekleme yapılmış mı?
    if (lastBackupDate === today) {
        return { shouldRun: false, lastBackupDate }
    }

    return { shouldRun: true, lastBackupDate }
}

/**
 * Bugün yedekleme yapılmış mı kontrol eder (basit boolean döner)
 */
export async function isBackupDoneToday(): Promise<boolean> {
    const { shouldRun } = await shouldRunBackup()
    return !shouldRun
}

/**
 * Bir okulun tüm verilerini yedekler (students, orders, transactions, products)
 */
async function backupSchoolData(schoolId: string) {
    const supabase = await createClient()

    try {
        // Tüm verileri çek
        const [studentsResult, ordersResult, transactionsResult, productsResult] = await Promise.all([
            supabase.from('students').select('*').eq('school_id', schoolId),
            supabase.from('orders').select('*').eq('school_id', schoolId),
            supabase.from('transactions').select('*').eq('school_id', schoolId),
            supabase.from('products').select('*').eq('school_id', schoolId)
        ])

        // Hata kontrolü
        if (studentsResult.error) {
            console.error(`Okul ${schoolId} için students verisi alınırken hata:`, studentsResult.error)
        }
        if (ordersResult.error) {
            console.error(`Okul ${schoolId} için orders verisi alınırken hata:`, ordersResult.error)
        }
        if (transactionsResult.error) {
            console.error(`Okul ${schoolId} için transactions verisi alınırken hata:`, transactionsResult.error)
        }
        if (productsResult.error) {
            console.error(`Okul ${schoolId} için products verisi alınırken hata:`, productsResult.error)
        }

        // Yedekleme objesi oluştur
        const backupData = {
            school_id: schoolId,
            backup_date: new Date().toISOString(),
            data: {
                students: studentsResult.data || [],
                orders: ordersResult.data || [],
                transactions: transactionsResult.data || [],
                products: productsResult.data || []
            },
            metadata: {
                students_count: studentsResult.data?.length || 0,
                orders_count: ordersResult.data?.length || 0,
                transactions_count: transactionsResult.data?.length || 0,
                products_count: productsResult.data?.length || 0
            }
        }

        // JSON string'e çevir
        const jsonData = JSON.stringify(backupData, null, 2)
        const blob = new Blob([jsonData], { type: 'application/json' })

        // Dosya adı: {school_id}/YYYY-MM-DD.json
        const today = new Date().toISOString().split('T')[0]
        const filePath = `${schoolId}/${today}.json`

        // Storage'a yükle
        const { error: uploadError } = await supabase.storage
            .from('backups')
            .upload(filePath, blob, {
                contentType: 'application/json',
                upsert: true // Aynı gün tekrar yedekleme yapılırsa üzerine yaz
            })

        if (uploadError) {
            console.error(`Okul ${schoolId} yedeklemesi yüklenirken hata:`, uploadError)
            return { success: false, error: uploadError.message }
        }

        return { success: true, filePath }
    } catch (error: any) {
        console.error(`Okul ${schoolId} yedekleme hatası:`, error)
        return { success: false, error: error.message || 'Bilinmeyen hata' }
    }
}

/**
 * Bir okulun klasöründeki 7 günden eski yedekleri siler
 */
async function cleanupOldBackups(schoolId: string) {
    const supabase = await createClient()

    try {
        // Okul klasöründeki tüm dosyaları listele
        const { data: files, error: listError } = await supabase.storage
            .from('backups')
            .list(schoolId, {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' }
            })

        if (listError) {
            console.error(`Okul ${schoolId} dosyaları listelenirken hata:`, listError)
            return { success: false, error: listError.message }
        }

        if (!files || files.length === 0) {
            return { success: true, deletedCount: 0 }
        }

        // 7 gün öncesini hesapla (YYYY-MM-DD formatında)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        const cutoffDateStr = sevenDaysAgo.toISOString().split('T')[0]

        // Eski dosyaları bul ve sil (dosya adı YYYY-MM-DD.json formatında)
        const filesToDelete: string[] = []

        for (const file of files) {
            // Dosya adından tarihi çıkar (YYYY-MM-DD.json -> YYYY-MM-DD)
            const fileDate = file.name.replace('.json', '')
            if (fileDate < cutoffDateStr) {
                filesToDelete.push(`${schoolId}/${file.name}`)
            }
        }

        if (filesToDelete.length === 0) {
            return { success: true, deletedCount: 0 }
        }

        // Dosyaları sil
        const { error: deleteError } = await supabase.storage
            .from('backups')
            .remove(filesToDelete)

        if (deleteError) {
            console.error(`Okul ${schoolId} eski yedekleri silinirken hata:`, deleteError)
            return { success: false, error: deleteError.message }
        }

        return { success: true, deletedCount: filesToDelete.length }
    } catch (error: any) {
        console.error(`Okul ${schoolId} temizlik hatası:`, error)
        return { success: false, error: error.message || 'Bilinmeyen hata' }
    }
}

/**
 * Tüm okulların yedeklemesini yapar
 * Bu fonksiyon client-side'dan çağrılabilir
 */
export async function backupAllSchools(): Promise<{ success: boolean; message: string; error?: string; successCount?: number; errorCount?: number }> {
    const supabase = await createClient()

    try {
        // 1. Önce bugün yedekleme yapılmış mı kontrol et
        const { shouldRun, lastBackupDate } = await shouldRunBackup()

        if (!shouldRun) {
            return {
                success: true,
                message: `Bugün zaten yedekleme yapılmış. Son yedekleme: ${lastBackupDate}`,
                successCount: 0,
                errorCount: 0
            }
        }

        // 2. Bucket'ın var olduğundan emin ol
        const bucketCheck = await ensureBackupBucket()
        if (!bucketCheck.success) {
            return {
                success: false,
                message: 'Yedekleme başlatılamadı',
                error: bucketCheck.error || 'Bucket kontrolü başarısız',
                successCount: 0,
                errorCount: 0
            }
        }

        // 3. Tüm okulları çek
        const { data: schools, error: schoolsError } = await supabase
            .from('schools')
            .select('id, name')

        if (schoolsError) {
            return {
                success: false,
                message: 'Okullar alınırken hata oluştu',
                error: schoolsError.message,
                successCount: 0,
                errorCount: 0
            }
        }

        if (!schools || schools.length === 0) {
            return {
                success: true,
                message: 'Yedeklenecek okul bulunamadı',
                successCount: 0,
                errorCount: 0
            }
        }

        // 4. Her okul için yedekleme yap
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        for (const school of schools) {
            try {
                // Yedekleme yap
                const backupResult = await backupSchoolData(school.id)

                if (backupResult.success) {
                    successCount++
                    // Eski yedekleri temizle
                    await cleanupOldBackups(school.id)
                } else {
                    errorCount++
                    errors.push(`${school.name}: ${backupResult.error}`)
                }
            } catch (error: any) {
                errorCount++
                errors.push(`${school.name}: ${error.message || 'Bilinmeyen hata'}`)
            }
        }

        // 5. Son yedekleme tarihini güncelle
        const today = new Date().toISOString().split('T')[0]
        await setLastBackupDate(today)

        // 6. Sonuç mesajı
        let message = `Yedekleme tamamlandı. ${successCount} okul başarıyla yedeklendi.`
        if (errorCount > 0) {
            message += ` ${errorCount} okulda hata oluştu.`
        }

        revalidatePath('/dashboard')

        return {
            success: errorCount === 0,
            message,
            error: errors.length > 0 ? errors.join('; ') : undefined,
            successCount,
            errorCount
        }
    } catch (error: any) {
        console.error('Yedekleme hatası:', error)
        return {
            success: false,
            message: 'Yedekleme sırasında beklenmeyen bir hata oluştu',
            error: error.message || 'Bilinmeyen hata',
            successCount: 0,
            errorCount: 1
        }
    }
}

/**
 * Bir okulun yedeklerini listeler (Supabase Storage'dan)
 */
export async function getSchoolBackups(schoolId: string): Promise<{ success: boolean; backups?: any[]; error?: string }> {
    const supabase = await createClient()

    try {
        // Okul klasöründeki tüm dosyaları listele
        const { data: files, error: listError } = await supabase.storage
            .from('backups')
            .list(schoolId, {
                limit: 100,
                sortBy: { column: 'created_at', order: 'desc' }
            })

        if (listError) {
            console.error('Yedekler listelenirken hata:', listError)
            return { success: false, error: listError.message }
        }

        if (!files || files.length === 0) {
            return { success: true, backups: [] }
        }

        // Dosyaları formatla (modal için gerekli yapı)
        const backups = files
            .filter(file => file.name.endsWith('.json'))
            .map(file => ({
                fileName: file.name,
                date: file.created_at || file.updated_at || new Date().toISOString(),
                size: (file as any).metadata?.size || (file as any).size || 0,
                created_at: file.created_at || file.updated_at || new Date().toISOString()
            }))
            .slice(0, 10) // Son 10 yedekleme

        return { success: true, backups }
    } catch (error: any) {
        console.error('Yedekler listelenirken hata:', error)
        return { success: false, error: error.message || 'Bilinmeyen hata' }
    }
}

/**
 * Bir yedek dosyasını indirir
 */
export async function downloadBackupFile(schoolId: string, fileName: string): Promise<{ data?: any; error?: string }> {
    const supabase = await createClient()

    try {
        const filePath = `${schoolId}/${fileName}`

        // Dosyayı indir
        const { data, error: downloadError } = await supabase.storage
            .from('backups')
            .download(filePath)

        if (downloadError) {
            console.error('Yedek indirilirken hata:', downloadError)
            return { error: downloadError.message }
        }

        // JSON olarak parse et
        const text = await data.text()
        const jsonData = JSON.parse(text)

        return { data: jsonData }
    } catch (error: any) {
        console.error('Yedek indirilirken hata:', error)
        return { error: error.message || 'Bilinmeyen hata' }
    }
}

/**
 * Bir yedeği geri yükler (okulun tüm verilerini silip yedekten geri yükler)
 */
export async function restoreBackupData(schoolId: string, fileName: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createClient()

    try {
        // 1. Yedek dosyasını indir
        const filePath = `${schoolId}/${fileName}`
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('backups')
            .download(filePath)

        if (downloadError) {
            console.error('Yedek indirilirken hata:', downloadError)
            return { success: false, error: downloadError.message }
        }

        // 2. JSON'u parse et
        const text = await fileData.text()
        const backupData = JSON.parse(text)

        // 3. Okul ID kontrolü
        if (backupData.school_id !== schoolId) {
            return { success: false, error: 'Bu yedek dosyası bu okula ait değil!' }
        }

        // 4. MEVCUT VERİLERİ SİL
        await Promise.all([
            supabase.from('orders').delete().eq('school_id', schoolId),
            supabase.from('transactions').delete().eq('school_id', schoolId),
            supabase.from('products').delete().eq('school_id', schoolId),
            supabase.from('students').delete().eq('school_id', schoolId)
        ])

        // 5. VERİLERİ GERİ YÜKLE
        if (backupData.data) {
            if (backupData.data.students?.length > 0) {
                const { error: studentsError } = await supabase
                    .from('students')
                    .insert(backupData.data.students)
                if (studentsError) {
                    console.error('Öğrenciler geri yüklenirken hata:', studentsError)
                }
            }

            if (backupData.data.orders?.length > 0) {
                const { error: ordersError } = await supabase
                    .from('orders')
                    .insert(backupData.data.orders)
                if (ordersError) {
                    console.error('Siparişler geri yüklenirken hata:', ordersError)
                }
            }

            if (backupData.data.transactions?.length > 0) {
                const { error: transactionsError } = await supabase
                    .from('transactions')
                    .insert(backupData.data.transactions)
                if (transactionsError) {
                    console.error('İşlemler geri yüklenirken hata:', transactionsError)
                }
            }

            if (backupData.data.products?.length > 0) {
                const { error: productsError } = await supabase
                    .from('products')
                    .insert(backupData.data.products)
                if (productsError) {
                    console.error('Ürünler geri yüklenirken hata:', productsError)
                }
            }
        }

        revalidatePath('/dashboard/schools')

        return { success: true }
    } catch (error: any) {
        console.error('Geri yükleme hatası:', error)
        return { success: false, error: error.message || 'Bilinmeyen hata' }
    }
}
