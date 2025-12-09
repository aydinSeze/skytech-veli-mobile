'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
    Plus, Search, School as SchoolIcon, MapPin, Users, Key,
    Edit2, Trash2, X, Check, Copy, Power, DollarSign, Wallet, Minus, ChevronDown, ChevronUp, Building2,
    Download, Upload, Database, FileText, Calendar
} from 'lucide-react'
import { addSchoolCredit } from '@/actions/school-actions'
import { getSchoolBackups, downloadBackupFile, restoreBackupData } from '@/actions/backup-actions'

export const dynamic = 'force-dynamic'

interface School {
    id: string
    name: string
    address: string
    canteen_email?: string
    canteen_password?: string
    created_at: string
    is_active: boolean
    system_credit: number
    iban?: string
    tax_office?: string
    tax_number?: string
    authorized_person?: string
    contact_phone?: string
    students: { count: number }[]
    products: { count: number }[]
}

interface SchoolFormData {
    name: string
    address: string
    authorized_person?: string
    contact_phone?: string
    iban?: string
    tax_office?: string
    tax_number?: string
}

export default function SchoolsPage() {
    const supabase = createClient()
    const router = useRouter()
    const [schools, setSchools] = useState<School[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [userRole, setUserRole] = useState<string | null>(null)

    // Kredi Modalı
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false)
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null)
    const [creditAmount, setCreditAmount] = useState('')
    const [creditOperation, setCreditOperation] = useState<'add' | 'subtract'>('add')

    // Yedekleme/Geri Yükleme
    const [isBackupLoading, setIsBackupLoading] = useState(false)
    const [isRestoreLoading, setIsRestoreLoading] = useState(false)
    const [isBackupsModalOpen, setIsBackupsModalOpen] = useState(false)
    const [selectedSchoolForBackups, setSelectedSchoolForBackups] = useState<School | null>(null)
    const [backupsList, setBackupsList] = useState<any[]>([])
    const [loadingBackups, setLoadingBackups] = useState(false)

    const [formData, setFormData] = useState<SchoolFormData>({
        name: '',
        address: '',
        authorized_person: '',
        contact_phone: '',
        iban: '',
        tax_office: '',
        tax_number: ''
    })

    // Accordion state for billing info
    const [isBillingExpanded, setIsBillingExpanded] = useState(false)

    const [credentials, setCredentials] = useState({
        email: '',
        password: '',
        schoolName: ''
    })

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    router.push('/login?redirect=/dashboard/schools')
                    return
                }

                // Hızlı admin kontrolü (email bazlı)
                const isAdminEmail = user.email === 'admin@skytech.com' || user.email?.includes('admin')
                
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                const role = profile?.role || (isAdminEmail ? 'admin' : null)
                setUserRole(role)

                // Admin değilse yönlendir
                if (role !== 'admin' && role !== 'school_admin') {
                    router.push('/dashboard')
                    return
                }

                // Okulları çek (cache bypass ile)
                await fetchSchools()
            } catch (error) {
                console.error("Auth check error:", error)
                router.push('/login?redirect=/dashboard/schools')
            }
        }
        checkAuthAndFetch()
    }, [router, supabase])

    const fetchSchools = async () => {
        try {
            setLoading(true)
            
            // Cache bypass için timestamp ekle
            const timestamp = Date.now()
            const { data, error } = await supabase
                .from('schools')
                .select('*, students(count), products(count)')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Okullar çekilirken hata:', error)
                throw error
            }
            
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSchools(data as any || [])
        } catch (error) {
            console.error('Okullar çekilirken hata:', error)
            setSchools([]) // Hata durumunda boş array
        } finally {
            setLoading(false)
        }
    }

    const handleAddSchool = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            // 1. Okulu Veritabanına Ekle
            const { data: schoolData, error: schoolError } = await supabase
                .from('schools')
                .insert({
                    name: formData.name,
                    address: formData.address,
                    system_credit: 0, // Varsayılan
                    authorized_person: formData.authorized_person || null,
                    contact_phone: formData.contact_phone || null,
                    iban: formData.iban || null,
                    tax_office: formData.tax_office || null,
                    tax_number: formData.tax_number || null
                })
                .select()
                .single()

            if (schoolError) throw schoolError

            // 2. Otomatik E-posta ve Şifre Oluştur
            const slug = formData.name
                .toLowerCase()
                .replace(/ğ/g, 'g')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ç/g, 'c')
                .replace(/[^a-z0-9]/g, '')
                .slice(0, 10)

            const email = `kantin@${slug}.com`
            const password = Math.random().toString(36).slice(-8)

            // 3. API Route ile Kullanıcı Oluştur (Admin yetkisiyle)
            const response = await fetch('/api/create-school-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    schoolId: schoolData.id,
                    schoolName: schoolData.name
                })
            })

            const result = await response.json()

            if (!response.ok) {
                console.error('Kullanıcı oluşturma hatası:', result)
                alert('Okul eklendi ancak kullanıcı oluşturulamadı: ' + result.error)
            } else {
                // 4. Başarılı ise Okul Tablosuna Bilgileri Kaydet (Görüntüleme amaçlı - Opsiyonel ama pratik)
                await supabase
                    .from('schools')
                    .update({
                        canteen_email: email,
                        canteen_password: password // Güvenlik notu: Gerçek prodüksiyonda şifreler düz metin saklanmaz!
                    })
                    .eq('id', schoolData.id)

                setCredentials({
                    email: email,
                    password: password,
                    schoolName: schoolData.name
                })
                setIsCredentialsModalOpen(true)
            }

            // Temizlik
            setFormData({ 
                name: '', 
                address: '', 
                authorized_person: '', 
                contact_phone: '', 
                iban: '', 
                tax_office: '', 
                tax_number: '' 
            })
            setIsBillingExpanded(false)
            setIsAddModalOpen(false)
            fetchSchools() // Listeyi yenile

        } catch (error) {
            console.error('İşlem hatası:', error)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            alert('Bir hata oluştu: ' + (error as any).message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bu okulu ve tüm verilerini silmek istediğinize emin misiniz?')) return

        try {
            const { error } = await supabase.from('schools').delete().eq('id', id)
            if (error) throw error
            fetchSchools()
        } catch (error) {
            console.error('Silme hatası:', error)
            alert('Silinirken hata oluştu')
        }
    }

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        try {
            const newStatus = !currentStatus
            const { error } = await supabase
                .from('schools')
                .update({ is_active: newStatus })
                .eq('id', id)

            if (error) throw error

            setSchools(schools.map(school =>
                school.id === id ? { ...school, is_active: newStatus } : school
            ))

        } catch (error) {
            console.error('Durum güncelleme hatası:', error)
            alert('Durum güncellenirken bir hata oluştu.')
        }
    }

    const handleShowCredentials = (school: School) => {
        if (!school.canteen_email) {
            alert('Bu okul için kayıtlı giriş bilgisi bulunamadı.')
            return
        }
        setCredentials({
            email: school.canteen_email,
            password: school.canteen_password || '******',
            schoolName: school.name
        })
        setIsCredentialsModalOpen(true)
    }

    // KREDİ YÖNETİMİ
    const openCreditModal = (school: School) => {
        setSelectedSchool(school)
        setCreditAmount('')
        setCreditOperation('add')
        setIsCreditModalOpen(true)
    }

    const handleUpdateCredit = async () => {
        if (!selectedSchool || !creditAmount) return
        const amount = parseFloat(creditAmount)
        if (isNaN(amount) || amount <= 0) {
            alert('Geçerli bir tutar girin.')
            return
        }

        // Azaltma işlemi için negatif değer gönder
        const finalAmount = creditOperation === 'add' ? amount : -amount

        const result = await addSchoolCredit(selectedSchool.id, finalAmount)
        if (result.success) {
            alert(result.message)
            setIsCreditModalOpen(false)
            setCreditAmount('')
            setCreditOperation('add')
            // UI'ı anında güncelle
            await fetchSchools()
            router.refresh() // Next.js cache'i temizle
        } else {
            alert('Hata: ' + result.error)
        }
    }

    // YEDEKLEME FONKSİYONU (7 GÜNLÜK SİSTEM)
    const handleBackup = async (school: School) => {
        if (!confirm(`${school.name} okulunun tüm verilerini yedeklemek istediğinize emin misiniz?`)) return

        setIsBackupLoading(true)
        try {
            // Tüm okula ait verileri çek
            const [students, transactions, products, orders, personnel, etutMenus, canteens, suppliers, expenses] = await Promise.all([
                supabase.from('students').select('*').eq('school_id', school.id),
                supabase.from('transactions').select('*').eq('school_id', school.id),
                supabase.from('products').select('*').eq('school_id', school.id),
                supabase.from('orders').select('*').eq('school_id', school.id),
                supabase.from('school_personnel').select('*').eq('school_id', school.id),
                supabase.from('etut_menu').select('*').eq('school_id', school.id),
                supabase.from('canteens').select('*').eq('school_id', school.id),
                supabase.from('suppliers').select('*').eq('school_id', school.id),
                supabase.from('expenses').select('*').eq('school_id', school.id)
            ])

            // Okul bilgilerini al
            const { data: schoolData } = await supabase.from('schools').select('*').eq('id', school.id).single()

            // Yedekleme objesi oluştur
            const backupData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                school: schoolData,
                students: students.data || [],
                transactions: transactions.data || [],
                products: products.data || [],
                orders: orders.data || [],
                personnel: personnel.data || [],
                etutMenus: etutMenus.data || [],
                canteens: canteens.data || [],
                suppliers: suppliers.data || [],
                expenses: expenses.data || []
            }

            // Veritabanına kaydet (7 günlük yedekleme)
            const fileName = `okul_yedek_${school.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.json`
            const { data: { user } } = await supabase.auth.getUser()
            
            const { error: backupError } = await supabase
                .from('school_backups')
                .insert({
                    school_id: school.id,
                    backup_data: backupData,
                    file_name: fileName,
                    created_by: user?.id || null
                })

            if (backupError) {
                console.error('Yedekleme kayıt hatası:', backupError)
                // Hata olsa bile dosya indirmeye devam et
            }

            // JSON dosyası olarak indir
            const jsonStr = JSON.stringify(backupData, null, 2)
            const blob = new Blob([jsonStr], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = fileName
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            // 7 günden eski yedeklemeleri temizle
            await supabase.rpc('cleanup_old_backups')

            alert('✅ Yedekleme başarıyla tamamlandı ve 7 günlük arşive kaydedildi!')
        } catch (error) {
            console.error('Yedekleme hatası:', error)
            alert('❌ Yedekleme sırasında bir hata oluştu: ' + (error as Error).message)
        } finally {
            setIsBackupLoading(false)
        }
    }

    // GERİ YÜKLEME FONKSİYONU (Dosya veya Veritabanından)
    const handleRestore = async (school: School) => {
        // Önce veritabanındaki son 7 günlük yedeklemeleri göster
        const { data: backups } = await supabase
            .from('school_backups')
            .select('*')
            .eq('school_id', school.id)
            .order('backup_date', { ascending: false })
            .limit(10)

        if (backups && backups.length > 0) {
            const backupOptions = backups.map((b, idx) => {
                const date = new Date(b.backup_date)
                return `${idx + 1}. ${date.toLocaleString('tr-TR')} - ${b.file_name || 'Yedekleme'}`
            }).join('\n')

            const choice = prompt(
                `⚠️ UYARI: ${school.name} okulunun TÜM MEVCUT VERİLERİ SİLİNECEK!\n\n` +
                `Son 7 günlük yedeklemeler:\n${backupOptions}\n\n` +
                `Bir yedekleme seçmek için numarasını girin (1-${backups.length}),\n` +
                `veya JSON dosyası yüklemek için "dosya" yazın:`
            )

            if (!choice) return

            if (choice.toLowerCase() === 'dosya') {
                // Dosya seçici
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.json'
                input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    await restoreFromFile(file, school)
                }
                input.click()
            } else {
                // Veritabanından seçilen yedeklemeyi geri yükle
                const selectedIndex = parseInt(choice) - 1
                if (selectedIndex >= 0 && selectedIndex < backups.length) {
                    await restoreFromBackup(backups[selectedIndex], school)
                } else {
                    alert('❌ Geçersiz seçim!')
                }
            }
        } else {
            // Yedekleme yoksa sadece dosya seçici
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file) return
                await restoreFromFile(file, school)
            }
            input.click()
        }
    }

    // Dosyadan geri yükleme
    const restoreFromFile = async (file: File, school: School) => {
        setIsRestoreLoading(true)
        try {
            const text = await file.text()
            const backupData = JSON.parse(text)
            await performRestore(backupData, school)
        } catch (error) {
            console.error('Geri yükleme hatası:', error)
            alert('❌ Geri yükleme sırasında bir hata oluştu: ' + (error as Error).message)
        } finally {
            setIsRestoreLoading(false)
        }
    }

    // Veritabanından geri yükleme
    const restoreFromBackup = async (backup: any, school: School) => {
        setIsRestoreLoading(true)
        try {
            const backupData = backup.backup_data
            await performRestore(backupData, school)
        } catch (error) {
            console.error('Geri yükleme hatası:', error)
            alert('❌ Geri yükleme sırasında bir hata oluştu: ' + (error as Error).message)
        } finally {
            setIsRestoreLoading(false)
        }
    }

    // Yedeklemeleri listele
    const handleShowBackups = async (school: School) => {
        setSelectedSchoolForBackups(school)
        setIsBackupsModalOpen(true)
        setLoadingBackups(true)

        try {
            const result = await getSchoolBackups(school.id)
            if (result.success) {
                setBackupsList(result.backups || [])
            } else {
                console.error('Yedeklemeler çekilirken hata:', result.error)
                alert('Yedeklemeler yüklenirken hata: ' + (result.error || 'Bilinmeyen hata'))
                setBackupsList([])
            }
        } catch (error: any) {
            console.error('Yedeklemeler yüklenirken hata:', error)
            alert('Yedeklemeler yüklenirken hata: ' + error.message)
            setBackupsList([])
        } finally {
            setLoadingBackups(false)
        }
    }

    // Yedeği geri yükle
    const handleRestoreFromBackup = async (fileName: string) => {
        if (!selectedSchoolForBackups) return
        
        if (!confirm(`⚠️ UYARI: "${selectedSchoolForBackups.name}" okulunun TÜM MEVCUT VERİLERİ SİLİNECEK ve "${fileName}" yedeği ile değiştirilecektir. Emin misiniz?`)) {
            return
        }

        setIsRestoreLoading(true)
        try {
            const result = await restoreBackupData(selectedSchoolForBackups.id, fileName)
            if (result.success) {
                alert('✅ Geri yükleme başarıyla tamamlandı!')
                setIsBackupsModalOpen(false)
                fetchSchools() // Listeyi yenile
                router.refresh() // Next.js cache'i temizle
            } else {
                alert('❌ Geri yükleme hatası: ' + (result.error || 'Bilinmeyen hata'))
            }
        } catch (error: any) {
            console.error('Geri yükleme hatası:', error)
            alert('❌ Geri yükleme sırasında bir hata oluştu: ' + error.message)
        } finally {
            setIsRestoreLoading(false)
        }
    }

    // Yedeği indir
    const handleDownloadBackup = async (fileName: string) => {
        if (!selectedSchoolForBackups) return
        
        try {
            const result = await downloadBackupFile(selectedSchoolForBackups.id, fileName)
            if (result.data) {
                const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = fileName
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                alert('✅ Yedek başarıyla indirildi!')
            } else {
                alert('❌ Yedek indirilirken hata: ' + (result.error || 'Bilinmeyen hata'))
            }
        } catch (error: any) {
            console.error('Yedek indirme hatası:', error)
            alert('❌ Yedek indirilirken bir hata oluştu: ' + error.message)
        }
    }

    // Geri yükleme işlemini gerçekleştir
    const performRestore = async (backupData: any, school: School) => {
        // Okul ID kontrolü
        if (backupData.school?.id !== school.id) {
            alert('❌ Bu yedek dosyası bu okula ait değil!')
            return
        }

        // ÖNCE MEVCUT VERİLERİ SİL
        await Promise.all([
            supabase.from('expenses').delete().eq('school_id', school.id),
            supabase.from('suppliers').delete().eq('school_id', school.id),
            supabase.from('canteens').delete().eq('school_id', school.id),
            supabase.from('etut_menu').delete().eq('school_id', school.id),
            supabase.from('school_personnel').delete().eq('school_id', school.id),
            supabase.from('orders').delete().eq('school_id', school.id),
            supabase.from('products').delete().eq('school_id', school.id),
            supabase.from('transactions').delete().eq('school_id', school.id),
            supabase.from('students').delete().eq('school_id', school.id)
        ])

        // SONRA VERİLERİ GERİ YÜKLE
        if (backupData.students?.length > 0) {
            await supabase.from('students').insert(backupData.students)
        }
        if (backupData.transactions?.length > 0) {
            await supabase.from('transactions').insert(backupData.transactions)
        }
        if (backupData.products?.length > 0) {
            await supabase.from('products').insert(backupData.products)
        }
        if (backupData.orders?.length > 0) {
            await supabase.from('orders').insert(backupData.orders)
        }
        if (backupData.personnel?.length > 0) {
            await supabase.from('school_personnel').insert(backupData.personnel)
        }
        if (backupData.etutMenus?.length > 0) {
            await supabase.from('etut_menu').insert(backupData.etutMenus)
        }
        if (backupData.canteens?.length > 0) {
            await supabase.from('canteens').insert(backupData.canteens)
        }
        if (backupData.suppliers?.length > 0) {
            await supabase.from('suppliers').insert(backupData.suppliers)
        }
        if (backupData.expenses?.length > 0) {
            await supabase.from('expenses').insert(backupData.expenses)
        }

        // Okul bilgilerini güncelle (sistem_credit hariç - güvenlik için)
        if (backupData.school) {
            const { system_credit, ...schoolUpdateData } = backupData.school
            await supabase.from('schools').update(schoolUpdateData).eq('id', school.id)
        }

        alert('✅ Geri yükleme başarıyla tamamlandı!')
        await fetchSchools()
        router.refresh()
    }


    const filteredSchools = schools.filter(school =>
        school.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">Okul Yönetimi</h1>
                    <p className="text-slate-400 mt-1">Sisteme kayıtlı okulları yönetin</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors"
                >
                    <Plus size={20} />
                    Yeni Okul Ekle
                </button>
            </div>

            {/* Arama */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                    type="text"
                    placeholder="Okul ara..."
                    className="w-full bg-slate-900 border border-slate-800 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Liste */}
            <div className="grid gap-4">
                {loading ? (
                    <div className="text-center text-slate-500 py-10">Yükleniyor...</div>
                ) : userRole !== 'admin' && userRole !== 'school_admin' ? (
                    <div className="text-center text-red-500 py-10">Bu sayfaya erişim yetkiniz bulunmamaktadır.</div>
                ) : filteredSchools.length === 0 ? (
                    <div className="text-center text-slate-500 py-10">Kayıtlı okul bulunamadı.</div>
                ) : (
                    filteredSchools.map((school) => {
                        const isRisky = (school.system_credit || 0) <= 0
                        return (
                            <div key={school.id}
                                className={`bg-slate-900 rounded-xl p-6 border transition-all hover:shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative group
                                ${isRisky ? 'border-red-500/50 shadow-red-900/10' : 'border-slate-800 hover:border-slate-700'}`}>

                                {/* Tıklanabilir Alan (Link) - Absolute ile tüm kartı kaplar */}
                                <Link href={`/dashboard/schools/${school.id}`} className="absolute inset-0 z-0" />

                                <div className="flex items-start gap-4 z-10 pointer-events-none">
                                    <div className={`p-3 rounded-lg transition-colors ${school.is_active ? 'bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20' : 'bg-red-500/10 text-red-400'}`}>
                                        <SchoolIcon size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2 group-hover:text-indigo-400 transition-colors">
                                            {school.name}
                                            {!school.is_active && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">PASİF</span>}
                                            {isRisky && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded animate-pulse">BAKİYE YETERSİZ</span>}
                                        </h3>
                                        <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                                            <span className="flex items-center gap-1"><MapPin size={14} /> {school.address}</span>
                                            <span className="flex items-center gap-1"><Users size={14} /> {school.students?.[0]?.count || 0} Öğrenci</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 z-10">
                                    {/* KREDİ DURUMU */}
                                    <div className="text-right mr-4 pointer-events-none">
                                        <div className="text-xs text-slate-500">Sistem Kredisi</div>
                                        <div className={`text-xl font-bold ${isRisky ? 'text-red-500' : 'text-green-400'}`}>
                                            ₺{(school.system_credit || 0).toLocaleString('tr-TR')}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleShowBackups(school); }}
                                            className="p-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white rounded-lg transition-colors relative z-20"
                                            title="Yedekler (Son 7 Gün)">
                                            <Database size={20} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleBackup(school); }}
                                            disabled={isBackupLoading}
                                            className="p-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg transition-colors relative z-20 disabled:opacity-50"
                                            title="Yedekle (Download JSON)">
                                            <Download size={20} />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRestore(school); }}
                                            disabled={isRestoreLoading}
                                            className="p-2 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white rounded-lg transition-colors relative z-20 disabled:opacity-50"
                                            title="Geri Yükle (Restore JSON)">
                                            <Upload size={20} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); openCreditModal(school); }}
                                            className="p-2 bg-green-600/20 hover:bg-green-600 text-green-400 hover:text-white rounded-lg transition-colors relative z-20"
                                            title="Kredi Yükle">
                                            <Wallet size={20} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleShowCredentials(school); }}
                                            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors relative z-20"
                                            title="Giriş Bilgileri">
                                            <Key size={20} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleToggleStatus(school.id, school.is_active); }}
                                            className={`p-2 rounded-lg transition-colors relative z-20 ${school.is_active ? 'bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400' : 'bg-green-900/20 hover:bg-green-900/40 text-green-400'}`}
                                            title={school.is_active ? 'Pasife Al' : 'Aktifleştir'}>
                                            <Power size={20} />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDelete(school.id); }}
                                            className="p-2 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-lg transition-colors relative z-20"
                                            title="Sil">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* OKUL EKLEME MODALI */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-slate-900 p-8 rounded-2xl w-full max-w-2xl border border-slate-800 shadow-2xl my-8">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Yeni Okul Ekle</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddSchool} className="space-y-4">
                            {/* Temel Bilgiler */}
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Okul Adı <span className="text-red-400">*</span></label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Adres / Konum <span className="text-red-400">*</span></label>
                                <textarea
                                    required
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500 h-24 resize-none"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>

                            {/* Şirket/Fatura Bilgileri Accordion */}
                            <div className="border border-slate-700 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setIsBillingExpanded(!isBillingExpanded)}
                                    className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Building2 size={20} className="text-indigo-400" />
                                        <span className="font-medium text-white">Şirket/Fatura Bilgileri</span>
                                        <span className="text-xs text-slate-500">(Opsiyonel)</span>
                                    </div>
                                    {isBillingExpanded ? (
                                        <ChevronUp size={20} className="text-slate-400" />
                                    ) : (
                                        <ChevronDown size={20} className="text-slate-400" />
                                    )}
                                </button>
                                
                                {isBillingExpanded && (
                                    <div className="p-4 space-y-4 bg-slate-900/50 border-t border-slate-700">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                                Yetkili Adı Soyadı <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                                value={formData.authorized_person}
                                                onChange={(e) => setFormData({ ...formData, authorized_person: e.target.value })}
                                                placeholder="Örn: Ahmet Yılmaz"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                                Yetkili Telefonu <span className="text-red-400">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                required
                                                className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                                value={formData.contact_phone}
                                                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                                placeholder="05XX XXX XX XX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">
                                                IBAN <span className="text-slate-500">(TR ile başlamalı)</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                                                value={formData.iban}
                                                onChange={(e) => {
                                                    let value = e.target.value.toUpperCase().replace(/\s/g, '')
                                                    if (value && !value.startsWith('TR')) {
                                                        value = 'TR' + value.replace(/^TR/, '')
                                                    }
                                                    setFormData({ ...formData, iban: value })
                                                }}
                                                placeholder="TR00 0000 0000 0000 0000 0000 00"
                                                maxLength={34}
                                            />
                                            {formData.iban && !formData.iban.startsWith('TR') && (
                                                <p className="text-xs text-yellow-400 mt-1">IBAN TR ile başlamalıdır</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Vergi Dairesi</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                                value={formData.tax_office}
                                                onChange={(e) => setFormData({ ...formData, tax_office: e.target.value })}
                                                placeholder="Örn: Kadıköy Vergi Dairesi"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-400 mb-1">Vergi No / T.C.</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                                value={formData.tax_number}
                                                onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                                                placeholder="11 haneli T.C. veya Vergi No"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
                            >
                                {submitting ? 'Ekleniyor...' : 'Kaydet ve Oluştur'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* GİRİŞ BİLGİLERİ MODALI */}
            {isCredentialsModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-8 rounded-2xl w-full max-w-md border border-green-500/30 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check size={32} className="text-green-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">Giriş Bilgileri</h2>
                            <p className="text-slate-400 mt-2">{credentials.schoolName}</p>
                        </div>

                        <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                            <div>
                                <label className="text-xs text-slate-500 uppercase font-bold">E-posta</label>
                                <div className="flex items-center justify-between mt-1">
                                    <code className="text-green-400 font-mono text-lg">{credentials.email}</code>
                                    <button onClick={() => navigator.clipboard.writeText(credentials.email)} className="text-slate-400 hover:text-white"><Copy size={16} /></button>
                                </div>
                            </div>
                            <div className="border-t border-slate-700 pt-3">
                                <label className="text-xs text-slate-500 uppercase font-bold">Şifre</label>
                                <div className="flex items-center justify-between mt-1">
                                    <code className="text-green-400 font-mono text-lg">{credentials.password}</code>
                                    <button onClick={() => navigator.clipboard.writeText(credentials.password)} className="text-slate-400 hover:text-white"><Copy size={16} /></button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-xs text-slate-500 mb-4">Bu bilgileri okul yönetimi ile paylaşınız.</p>
                            <button onClick={() => setIsCredentialsModalOpen(false)} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-bold">
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* KREDİ YÖNETİM MODALI */}
            {isCreditModalOpen && selectedSchool && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-8 rounded-2xl w-full max-w-md border border-slate-800 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Wallet size={28} className="text-indigo-400" />
                                    Kredi Yönetimi
                                </h2>
                                <p className="text-slate-400 mt-1">{selectedSchool.name}</p>
                            </div>
                            <button onClick={() => setIsCreditModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Mevcut Bakiye */}
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-4 mb-6">
                            <div className="text-xs text-slate-400 uppercase font-bold mb-1">Mevcut Sistem Kredisi</div>
                            <div className="text-3xl font-bold text-green-400">
                                ₺{(selectedSchool.system_credit || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>

                        {/* İşlem Tipi Seçimi */}
                        <div className="mb-6">
                            <label className="block text-sm text-slate-400 mb-3 font-medium">İşlem Tipi</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setCreditOperation('add')}
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        creditOperation === 'add'
                                            ? 'bg-green-500/20 border-green-500 text-green-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Plus size={20} />
                                        <span className="font-bold">Artır</span>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setCreditOperation('subtract')}
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        creditOperation === 'subtract'
                                            ? 'bg-red-500/20 border-red-500 text-red-400'
                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-center gap-2">
                                        <Minus size={20} />
                                        <span className="font-bold">Azalt</span>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Tutar Girişi */}
                        <div className="mb-6">
                            <label className="block text-sm text-slate-400 mb-2 font-medium">
                                {creditOperation === 'add' ? 'Artırılacak' : 'Azaltılacak'} Tutar (TL)
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                className={`w-full bg-slate-800 text-white text-2xl p-4 rounded-lg border-2 focus:ring-2 outline-none text-center font-bold transition-colors ${
                                    creditOperation === 'add'
                                        ? 'border-green-500 focus:ring-green-500'
                                        : 'border-red-500 focus:ring-red-500'
                                }`}
                                placeholder="0.00"
                                value={creditAmount}
                                onChange={e => setCreditAmount(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Yeni Bakiye Önizlemesi */}
                        {creditAmount && !isNaN(parseFloat(creditAmount)) && parseFloat(creditAmount) > 0 && (
                            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6">
                                <div className="text-xs text-slate-400 uppercase font-bold mb-1">Yeni Bakiye</div>
                                <div className={`text-2xl font-bold ${
                                    (() => {
                                        const current = selectedSchool.system_credit || 0
                                        const change = creditOperation === 'add' ? parseFloat(creditAmount) : -parseFloat(creditAmount)
                                        const newBalance = current + change
                                        return newBalance < 0 ? 'text-red-400' : 'text-green-400'
                                    })()
                                }`}>
                                    ₺{(() => {
                                        const current = selectedSchool.system_credit || 0
                                        const change = creditOperation === 'add' ? parseFloat(creditAmount) : -parseFloat(creditAmount)
                                        const newBalance = current + change
                                        return newBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Butonlar */}
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsCreditModalOpen(false)} 
                                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-medium transition-colors"
                            >
                                İptal
                            </button>
                            <button 
                                onClick={handleUpdateCredit} 
                                className={`flex-1 text-white py-3 rounded-lg font-bold transition-colors ${
                                    creditOperation === 'add'
                                        ? 'bg-green-600 hover:bg-green-500'
                                        : 'bg-red-600 hover:bg-red-500'
                                }`}
                            >
                                {creditOperation === 'add' ? '💰 Artır' : '📉 Azalt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* YEDEKLER MODALI */}
            {isBackupsModalOpen && selectedSchoolForBackups && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-8 rounded-2xl w-full max-w-2xl border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                    <Database size={28} className="text-indigo-400" />
                                    Yedekler
                                </h2>
                                <p className="text-slate-400 mt-1">{selectedSchoolForBackups.name}</p>
                            </div>
                            <button onClick={() => setIsBackupsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        {loadingBackups ? (
                            <div className="text-center text-slate-500 py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                                Yedekler yükleniyor...
                            </div>
                        ) : backupsList.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">
                                <FileText size={48} className="mx-auto mb-4 text-slate-600" />
                                <p>Son 7 gün içinde yedek bulunamadı.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="text-sm text-slate-400 mb-4">
                                    Son 7 günlük yedekler ({backupsList.length} adet)
                                </div>
                                {backupsList.map((backup, index) => {
                                    const backupDate = new Date(backup.date)
                                    const formattedDate = backupDate.toLocaleString('tr-TR', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })
                                    const fileSizeMB = (backup.size / (1024 * 1024)).toFixed(2)
                                    
                                    return (
                                        <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex items-center justify-between hover:bg-slate-800 transition-colors">
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className="p-2 bg-indigo-500/20 rounded-lg">
                                                    <FileText size={20} className="text-indigo-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-white font-medium flex items-center gap-2">
                                                        <Calendar size={16} className="text-slate-400" />
                                                        {backup.fileName}
                                                    </div>
                                                    <div className="text-sm text-slate-400 mt-1">
                                                        {formattedDate} • {fileSizeMB} MB
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleDownloadBackup(backup.fileName)}
                                                    className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                                    title="Yedeği İndir"
                                                >
                                                    <Download size={16} />
                                                    İndir
                                                </button>
                                                <button
                                                    onClick={() => handleRestoreFromBackup(backup.fileName)}
                                                    disabled={isRestoreLoading}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                    title="Yedeği Geri Yükle"
                                                >
                                                    {isRestoreLoading ? (
                                                        <>
                                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                                            Yükleniyor...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Upload size={16} />
                                                            Geri Yükle
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}