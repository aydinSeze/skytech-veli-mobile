'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. OKUL KREDİSİ YÜKLEME (Admin - Manuel Yükleme)
export async function addSchoolCredit(schoolId: string, amount: number) {
    try {
        // Modern Next.js 16+ standartlarına uygun client oluşturma
        const supabase = await createClient()

        // Oturum Kontrolü - getUser() kullanarak daha güvenilir kontrol
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError) {
            console.error("Supabase Auth Error:", authError)
            return { success: false, error: 'Oturum doğrulanamadı. Lütfen sayfayı yenileyip tekrar giriş yapın.' }
        }

        if (!user) {
            return { success: false, error: 'Oturum doğrulanamadı. Lütfen sayfayı yenileyip tekrar giriş yapın.' }
        }

        // Admin rol kontrolü
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        const userRole = profile?.role || (user.email === 'admin@skytech.com' || user.email?.includes('admin') ? 'admin' : null)

        if (userRole !== 'admin' && userRole !== 'school_admin') {
            return { success: false, error: 'Bu işlem için yetkiniz bulunmamaktadır.' }
        }

        // Okulun mevcut kredisini çek
        const { data: school, error: fetchError } = await supabase
            .from('schools')
            .select('system_credit')
            .eq('id', schoolId)
            .single()

        if (fetchError || !school) {
            console.error("School Fetch Error:", fetchError)
            return { success: false, error: 'Okul bulunamadı.' }
        }

        // amount pozitif veya negatif olabilir (artırma/azaltma için)
        const newCredit = Number(school.system_credit || 0) + Number(amount)
        
        // Negatif bakiyeye düşmesini engelle (opsiyonel - isterseniz kaldırabilirsiniz)
        // if (newCredit < 0) {
        //     return { success: false, error: 'Kredi negatif olamaz. Mevcut kredi: ₺' + (school.system_credit || 0) }
        // }

        // Krediyi güncelle
        const { error: updateError } = await supabase
            .from('schools')
            .update({ system_credit: newCredit })
            .eq('id', schoolId)

        if (updateError) {
            console.error("Update Error:", updateError)
            return { success: false, error: updateError.message }
        }

        // Log Kaydı (Admin için)
        const operationType = amount >= 0 ? 'Yükleme' : 'Azaltma'
        await supabase.from('admin_credit_logs').insert({
            school_id: schoolId,
            amount: amount,
            description: `Yönetim Paneli Manuel ${operationType}`,
            note: `Yönetim Paneli üzerinden ${operationType.toLowerCase()} (${user.email})`
        })

        revalidatePath('/dashboard/schools')
        revalidatePath('/dashboard')
        
        if (amount >= 0) {
            return { success: true, message: `Okula ₺${Math.abs(amount)} kredi yüklendi. Yeni Bakiye: ₺${newCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
        } else {
            return { success: true, message: `Okuldan ₺${Math.abs(amount)} kredi düşüldü. Yeni Bakiye: ₺${newCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
        }

    } catch (err) {
        console.error("Beklenmeyen Hata:", err)
        return { success: false, error: 'Sunucu hatası oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata') }
    }
}

// 2. FİNANSAL PIN GÜNCELLEME (Kantinci İçin)
export async function updateSchoolPin(prevState: any, formData: FormData) {
    try {
        const supabase = await createClient()

        const currentPin = formData.get('currentPin') as string
        const newPin = formData.get('newPin') as string
        const confirmPin = formData.get('confirmPin') as string

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return { success: false, error: 'Oturum bulunamadı. Lütfen tekrar giriş yapın.' }
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('school_id')
            .eq('id', user.id)
            .single()

        if (!profile?.school_id) {
            return { success: false, error: 'Okul bilgisi bulunamadı.' }
        }

        // Okul bilgisini çek (PIN kontrolü için)
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('privacy_pin, name')
            .eq('id', profile.school_id)
            .single()

        if (schoolError || !school) {
            return { success: false, error: 'Okul bilgisi alınamadı.' }
        }

        const hasExistingPin = !!school.privacy_pin

        // PIN varsa eski şifre ZORUNLU
        if (hasExistingPin) {
            if (!currentPin || currentPin.trim() === '') {
                return { success: false, error: 'Mevcut şifre gereklidir.' }
            }

            // Eski şifre kontrolü
            if (school.privacy_pin !== currentPin) {
                return { success: false, error: 'Mevcut şifre hatalı!' }
            }
        }

        // Yeni şifre validasyonu
        if (!newPin || newPin.length !== 4) {
            return { success: false, error: 'Yeni şifre 4 haneli olmalıdır.' }
        }

        if (newPin !== confirmPin) {
            return { success: false, error: 'Yeni şifreler eşleşmiyor.' }
        }

        // Aynı şifreyi tekrar girme kontrolü
        if (hasExistingPin && school.privacy_pin === newPin) {
            return { success: false, error: 'Yeni şifre mevcut şifre ile aynı olamaz.' }
        }

        // Yeni şifreyi kaydet
        const { error: updateError } = await supabase
            .from('schools')
            .update({ privacy_pin: newPin })
            .eq('id', profile.school_id)

        if (updateError) {
            console.error('PIN güncelleme hatası:', updateError)
            return { success: false, error: 'Şifre güncellenemedi: ' + updateError.message }
        }

        revalidatePath('/canteen/settings')
        return { success: true, message: hasExistingPin ? 'Şifre başarıyla güncellendi!' : 'Şifre başarıyla oluşturuldu!' }
    } catch (err) {
        console.error('PIN güncelleme beklenmeyen hata:', err)
        return { success: false, error: 'Beklenmeyen bir hata oluştu: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata') }
    }
}

// 3. PIN SIFIRLAMA (Admin İçin)
export async function resetSchoolPin(schoolId: string) {
    const supabase = await createClient()

    // Admin kontrolü
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { success: false, error: 'Oturum doğrulanamadı.' }
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const userRole = profile?.role || (user.email === 'admin@skytech.com' || user.email?.includes('admin') ? 'admin' : null)

    if (userRole !== 'admin' && userRole !== 'school_admin') {
        return { success: false, error: 'Bu işlem için yetkiniz bulunmamaktadır.' }
    }

    // Okul bilgisini önce çek (doğrulama için)
    const { data: schoolCheck, error: checkError } = await supabase
        .from('schools')
        .select('id, name')
        .eq('id', schoolId)
        .single()

    if (checkError || !schoolCheck) {
        console.error('PIN Sıfırlama - Okul bulunamadı:', checkError)
        return { success: false, error: 'Okul bulunamadı: ' + (checkError?.message || 'Bilinmeyen hata') }
    }

    // PIN'i güncelle
    const { data: updateData, error: updateError } = await supabase
        .from('schools')
        .update({ privacy_pin: '0000' })
        .eq('id', schoolId)
        .select('privacy_pin')

    if (updateError) {
        console.error('PIN Sıfırlama - Güncelleme hatası:', updateError)
        return { success: false, error: 'PIN güncellenemedi: ' + updateError.message }
    }

    // Güncelleme başarılı mı kontrol et
    if (!updateData || updateData.length === 0) {
        console.error('PIN Sıfırlama - Güncelleme sonucu boş')
        return { success: false, error: 'PIN güncellenemedi: Güncelleme sonucu alınamadı' }
    }

    console.log('PIN Sıfırlama - Başarılı:', { schoolId, schoolName: schoolCheck.name, newPin: updateData[0].privacy_pin })

    revalidatePath('/dashboard/schools')
    revalidatePath('/canteen/settings')
    return { success: true, message: `${schoolCheck.name} okulunun PIN'i başarıyla 0000 olarak sıfırlandı.` }
}
