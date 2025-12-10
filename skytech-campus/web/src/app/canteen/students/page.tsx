'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Clock, FileText, X, Zap, CreditCard, Pencil, CheckCircle, ScanBarcode } from 'lucide-react'
import { addStudentBalance } from '@/actions/student-actions'

// ÖNBELLEK İPTALİ (Her girişte taze veri çeksin)
export const dynamic = 'force-dynamic'

export default function StudentsPage() {
    const supabase = createClient()
    const [students, setStudents] = useState<any[]>([])
    const [schools, setSchools] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [schoolName, setSchoolName] = useState('SkyTech Campus') // Varsayılan
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // SAYFALAMA VE ARAMA AYARLARI
    const PAGE_SIZE = 20
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [isSearching, setIsSearching] = useState(false)

    // Para Yükleme Modalı
    const [depositModal, setDepositModal] = useState<{ open: boolean, student: any | null }>({ open: false, student: null })
    const [depositAmount, setDepositAmount] = useState('')
    const [isDepositSubmitting, setIsDepositSubmitting] = useState(false)

    // Geçmiş Modalı (Son 1 Ay)
    const [historyModal, setHistoryModal] = useState<{ open: boolean, student: any | null, transactions: any[] }>({ open: false, student: null, transactions: [] })

    // Düzenleme Modalı
    const [editModal, setEditModal] = useState<{ open: boolean, student: any | null }>({ open: false, student: null })
    const [editForm, setEditForm] = useState({
        full_name: '',
        class_branch: '',
        parent_name: '',
        parent_phone: '',
        nfc_card_id: '',
        credit_limit: 0
    })

    // Hızlı Eşleştirme Sihirbazı
    const [wizardModal, setWizardModal] = useState<{ open: boolean, currentIndex: number, students: any[] }>({ open: false, currentIndex: 0, students: [] })
    const [wizardInput, setWizardInput] = useState('')
    const wizardInputRef = useRef<HTMLInputElement>(null)

    // Öğrenci Formu
    const [form, setForm] = useState({
        school_id: '',
        full_name: '',
        class_branch: '',
        parent_name: '',
        parent_phone: '+90 (', // Telefon formatı başlangıç değeri
        nfc_card_id: '', // Yeni: Manuel Kart ID
        wallet_balance: 0,
        credit_limit: 0
    })

    // Rastgele Kart ID (Simülasyon)
    const generateCardId = () => {
        return Math.floor(1000000000 + Math.random() * 9000000000).toString()
    }

    // Telefon numarası formatı: +90 (XXX) XXX XX XX
    const formatPhoneNumber = (value: string) => {
        // Sadece rakamları al
        const numbers = value.replace(/\D/g, '')

        // +90'dan sonraki kısmı al (ilk 2 rakam 90 ise atla)
        let phoneNumbers = numbers
        if (numbers.startsWith('90') && numbers.length > 2) {
            phoneNumbers = numbers.substring(2)
        } else if (numbers.startsWith('0')) {
            phoneNumbers = numbers.substring(1)
        }

        // Maksimum 10 hane
        phoneNumbers = phoneNumbers.substring(0, 10)

        // Formatla: +90 (XXX) XXX XX XX
        if (phoneNumbers.length === 0) {
            return '+90 ('
        } else if (phoneNumbers.length <= 3) {
            return `+90 (${phoneNumbers}`
        } else if (phoneNumbers.length <= 6) {
            return `+90 (${phoneNumbers.substring(0, 3)}) ${phoneNumbers.substring(3)}`
        } else if (phoneNumbers.length <= 8) {
            return `+90 (${phoneNumbers.substring(0, 3)}) ${phoneNumbers.substring(3, 6)} ${phoneNumbers.substring(6)}`
        } else {
            return `+90 (${phoneNumbers.substring(0, 3)}) ${phoneNumbers.substring(3, 6)} ${phoneNumbers.substring(6, 8)} ${phoneNumbers.substring(8)}`
        }
    }

    // Telefon numarasından sadece rakamları çıkar (veritabanına kaydetmek için)
    const extractPhoneNumbers = (formattedPhone: string) => {
        const numbers = formattedPhone.replace(/\D/g, '')
        // 90 ile başlıyorsa sadece 90'dan sonrasını al
        if (numbers.startsWith('90') && numbers.length > 2) {
            return numbers.substring(2)
        } else if (numbers.startsWith('0')) {
            return numbers.substring(1)
        }
        return numbers.substring(0, 10)
    }

    // Telefon input handler
    const handlePhoneChange = (value: string, isEdit: boolean = false) => {
        const formatted = formatPhoneNumber(value)
        if (isEdit) {
            setEditForm({ ...editForm, parent_phone: formatted })
        } else {
            setForm({ ...form, parent_phone: formatted })
        }
    }

    const fetchData = async (targetPage = 0, search = '') => {
        setLoading(true)
        try {
            // 1. Kullanıcının Okul ID'sini Çek
            const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
            const urlSchoolId = urlParams.get('schoolId')
            let targetSchoolId: string | null = null

            // Okul ID belirle
            if (urlSchoolId) {
                targetSchoolId = urlSchoolId
                setUserSchoolId(urlSchoolId)
                // Okul adı çekme... (Basitleştirildi)
                const { data: school } = await supabase.from('schools').select('name').eq('id', urlSchoolId).single()
                if (school) setSchoolName(school.name)
            } else {
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('school_id, role').eq('id', user.id).single()
                    if (profile?.school_id) {
                        targetSchoolId = profile.school_id
                        setUserSchoolId(profile.school_id)
                        const { data: school } = await supabase.from('schools').select('name').eq('id', profile.school_id).single()
                        if (school) setSchoolName(school.name)
                    } else if (profile?.role === 'admin') {
                        /* Admin tüm okulları görür mantığı burada pagination ile karışık, şimdilik geçiyoruz */
                    }
                }
            }

            if (targetSchoolId) {
                // SORGULAMA (Server-Side Pagination & Search)
                let query = supabase
                    .from('students')
                    .select('id, full_name, student_number, nfc_card_id, wallet_balance, class_branch, parent_name, parent_phone, credit_limit, created_at, access_code', { count: 'exact' })
                    .eq('school_id', targetSchoolId)
                    .order('created_at', { ascending: false })

                // Arama varsa filtrele
                if (search.trim()) {
                    const term = search.trim()
                    // Güvenli arama için sadece harf/rakam
                    query = query.or(`full_name.ilike.%${term}%,class_branch.ilike.%${term}%,nfc_card_id.ilike.%${term}%,parent_name.ilike.%${term}%,access_code.ilike.%${term}%`)
                }

                // Sayfalama
                const from = targetPage * PAGE_SIZE
                const to = from + PAGE_SIZE - 1
                query = query.range(from, to)

                const { data, error, count } = await query

                if (error) {
                    console.error('❌ Öğrenci çekme hatası (DETAYLI - Admin):', error)
                    console.error('❌ Ham Error Objesi:', error)

                    const errorMessage = (error as any)?.message || 'Bilinmeyen hata'
                    const errorCode = (error as any)?.code

                    if (errorMessage.includes('permission') ||
                        errorMessage.includes('denied') ||
                        errorCode === '42501' ||
                        errorCode === 'PGRST301' ||
                        !data) {
                        console.error('🚫 RLS POLİTİKASI HATASI TESPİT EDİLDİ!')
                        alert('Erişim hatası: Bu okulun öğrencilerini görme yetkiniz yok.\n\nLütfen DIAGNOSE_STUDENTS_ERROR.sql dosyasını çalıştırın.')
                    } else {
                        alert(`Öğrenci verileri çekilemedi: ${errorMessage}`)
                    }

                    setStudents([])
                    return
                }

                console.log(`✅ ${data?.length || 0} adet öğrenci bulundu (Okul ID: ${urlSchoolId}, Toplam: ${count})`)
                setStudents(data || [])

                if (!data || data.length === 0) {
                    console.warn('⚠️ Bu okul için öğrenci bulunamadı!')
                }
            } else {
                // Normal kullanıcı - Profile'dan al
                const { data: { user }, error: userError } = await supabase.auth.getUser()

                if (userError || !user) {
                    console.error('❌ Kullanıcı oturumu bulunamadı:', userError)
                    alert('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
                    return
                }

                console.log('👤 Kullanıcı ID:', user.id)

                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('school_id, role')
                    .eq('id', user.id)
                    .single()

                if (profileError) {
                    console.error('❌ Profile bilgisi çekilemedi:', profileError)
                    alert(`Kullanıcı profili bulunamadı: ${profileError.message}`)
                    return
                }

                console.log('📋 Profile bilgisi:', profile)

                if (profile?.school_id) {
                    targetSchoolId = profile.school_id
                    setUserSchoolId(profile.school_id)

                    // Okul Adını Çek
                    const { data: school, error: schoolError } = await supabase
                        .from('schools')
                        .select('name')
                        .eq('id', profile.school_id)
                        .single()

                    if (schoolError) {
                        console.error('❌ Okul bilgisi çekilemedi:', schoolError)
                    } else if (school) {
                        setSchoolName(school.name)
                    }

                    // ÖNCE TEST: Basit sorgu ile RLS'i test et
                    console.log('🧪 RLS TEST: Basit count sorgusu yapılıyor...')
                    const { count: testCount, error: testError } = await supabase
                        .from('students')
                        .select('*', { count: 'exact', head: true })
                        .eq('school_id', profile.school_id)

                    console.log('🧪 RLS TEST Sonucu:', { testCount, testError: testError ? JSON.stringify(testError, null, 2) : null })

                    // Sadece bu okula ait öğrencileri çek (TÜM ÖĞRENCİLER - limit kaldırıldı)
                    console.log('📥 Öğrenci verileri çekiliyor...', { schoolId: profile.school_id })
                    const { data, error, count } = await supabase
                        .from('students')
                        .select('id, full_name, student_number, nfc_card_id, wallet_balance, class_branch, parent_name, parent_phone, credit_limit, created_at, access_code', { count: 'exact' })
                        .eq('school_id', profile.school_id)
                        .order('created_at', { ascending: false })

                    console.log('📥 Sorgu Sonucu:', {
                        dataLength: data?.length,
                        count,
                        hasError: !!error,
                        errorString: error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : null,
                        errorKeys: error ? Object.keys(error) : []
                    })

                    if (error) {
                        // Error objesini stringify et (circular reference olabilir)
                        const errorInfo = {
                            message: (error as any)?.message,
                            code: (error as any)?.code,
                            details: (error as any)?.details,
                            hint: (error as any)?.hint
                        }

                        console.error('❌ Öğrenci çekme hatası (DETAYLI):', errorInfo)
                        console.error('❌ Ham Error Objesi:', error)
                        console.error('❌ Profile School ID:', profile.school_id)
                        console.error('❌ User ID:', user.id)

                        // RLS hatası kontrolü
                        const errorMessage = (error as any)?.message || 'Bilinmeyen hata'
                        const errorCode = (error as any)?.code

                        if (errorMessage.includes('permission') ||
                            errorMessage.includes('denied') ||
                            errorCode === '42501' ||
                            errorCode === 'PGRST301' ||
                            !data) {
                            console.error('🚫 RLS POLİTİKASI HATASI TESPİT EDİLDİ!')
                            console.error('💡 Çözüm: FIX_STUDENTS_VISIBILITY_URGENT.sql dosyasını Supabase\'de çalıştırın')
                            alert('Erişim hatası: Bu okulun öğrencilerini görme yetkiniz yok.\n\nLütfen FIX_STUDENTS_VISIBILITY_URGENT.sql dosyasını Supabase\'de çalıştırın.')
                        } else {
                            alert(`Öğrenci verileri çekilemedi: ${errorMessage}`)
                        }

                        setStudents([])
                        return
                    }

                    console.log(`✅ ${data?.length || 0} adet öğrenci bulundu (Okul ID: ${profile.school_id}, Toplam: ${count})`)
                    setStudents(data || [])

                    if (!data || data.length === 0) {
                        console.warn('⚠️ Bu okul için öğrenci bulunamadı! Okul ID:', profile.school_id)
                    }
                } else {
                    // Profile'da school_id yok
                    console.warn('⚠️ Kullanıcı profilinde school_id bulunamadı!', { profile })

                    // Admin ise tüm okulları görebilir
                    if (profile?.role === 'admin') {
                        console.log('👑 Admin kullanıcı - tüm okullar gösteriliyor')
                        const { data: schoolsData, error: schoolsError } = await supabase.from('schools').select('*')

                        if (schoolsError) {
                            console.error('❌ Okullar çekilemedi:', schoolsError)
                        } else {
                            setSchools(schoolsData || [])
                        }
                    } else {
                        alert('Okul bilgisi bulunamadı. Lütfen yöneticiye başvurun.')
                    }
                }
            }
        } catch (error: any) {
            console.error('❌ Beklenmedik veri çekme hatası:', error)
            // Sadece gerçekten kritik hataları göster
            const errorMessage = error?.message || 'Bilinmeyen hata'
            const isTechnicalError = errorMessage.includes('does not exist') ||
                errorMessage.includes('column') ||
                errorMessage.includes('permission denied')

            if (!isTechnicalError) {
                console.warn('⚠️ Beklenmedik hata (kullanıcıya gösterilmeyecek):', errorMessage)
            }
            setStudents([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    // TEKLİ KAYIT
    const handleSave = async () => {
        const targetSchoolId = userSchoolId || form.school_id

        // Trim ile kontrol et
        const fullName = form.full_name?.trim() || ''
        const classBranch = form.class_branch?.trim() || ''

        if (!targetSchoolId) {
            alert('Okul bilgisi bulunamadı. Lütfen sayfayı yenileyin.')
            return
        }

        if (!fullName || !classBranch) {
            alert('Lütfen İsim ve Şube bilgilerini girin!')
            return
        }

        // Eğer kullanıcı kart ID girmediyse otomatik oluştur
        const finalCardId = form.nfc_card_id.trim() || generateCardId()

        // Benzersizlik kontrolü (Basit)
        const { data: existing } = await supabase.from('students').select('id').eq('nfc_card_id', finalCardId).single()
        if (existing) {
            alert('Bu Kart ID zaten kullanımda! Lütfen başka bir kart okutun.')
            return
        }

        // Telefon numarasını temizle (sadece rakamlar) - Boşsa null
        const cleanPhone = form.parent_phone && form.parent_phone !== '+90 ('
            ? extractPhoneNumbers(form.parent_phone)
            : null

        console.log('💾 Öğrenci kaydediliyor...', { targetSchoolId, fullName, classBranch })

        const { data: insertedData, error } = await supabase
            .from('students')
            .insert([{
                school_id: targetSchoolId,
                full_name: fullName.toUpperCase(), // Büyük harfe çevir
                class_branch: classBranch.toUpperCase(), // Büyük harfe çevir
                parent_name: form.parent_name?.trim().toUpperCase() || null, // Büyük harfe çevir
                parent_phone: cleanPhone || null, // Sadece rakamları kaydet veya null
                nfc_card_id: finalCardId,
                wallet_balance: form.wallet_balance || 0,
                credit_limit: form.credit_limit || 0
            }])
            .select() // Eklenen veriyi geri döndür

        if (error) {
            console.error('❌ Öğrenci ekleme hatası:', error)
            alert('Hata: ' + error.message)
            return
        }

        console.log('✅ Öğrenci başarıyla eklendi:', insertedData)

        // Formu temizle
        setForm({
            school_id: '',
            full_name: '',
            class_branch: '',
            parent_name: '',
            parent_phone: '+90 (', // Telefon formatı başlangıç değeri
            nfc_card_id: '',
            wallet_balance: 0,
            credit_limit: 0
        })

        // Listeyi yenile - ÖNEMLİ: await ile bekle
        await fetchData()

        // Başarı mesajı göster
        alert(`✅ Öğrenci Kaydedildi!\nKart ID: ${finalCardId}\n\nListe yenilendi.`)
    }

    // Şablon İndir - Basit ve anlaşılır format
    const handleDownloadTemplate = () => {
        // Basit sütun başlıkları
        const headers = ['Ad Soyad', 'Şube', 'Veli Adı', 'Veli Telefon', 'Veresiye Limiti']
        const exampleData = [
            ['Ali Veli', '5-A', 'Mehmet Veli', '5551234567', '100'],
            ['Ayşe Yılmaz', '6-B', 'Ahmet Yılmaz', '5559876543', '50']
        ]

        // Başlık satırı
        const data = [headers, ...exampleData]

        const ws = XLSX.utils.aoa_to_sheet(data)

        // Sütun genişliklerini ayarla
        ws['!cols'] = [
            { wch: 20 }, // Ad Soyad
            { wch: 10 }, // Şube
            { wch: 20 }, // Veli Adı
            { wch: 15 }, // Veli Telefon
            { wch: 15 }  // Veresiye Limiti
        ]

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Öğrenci Listesi')
        XLSX.writeFile(wb, 'ogrenci_yukleme_sablonu.xlsx')
    }

    // Excel Yükle - Toplu öğrenci ekleme
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const targetSchoolId = userSchoolId
        if (!targetSchoolId) {
            alert('Okul bilgisi bulunamadı. Lütfen sayfayı yenileyin.')
            return
        }

        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) // Array of arrays olarak oku

                if (data.length < 2) {
                    alert('Excel dosyasında veri bulunamadı. En az bir öğrenci bilgisi olmalıdır.')
                    return
                }

                // İlk satır başlık, onu atla
                const students = []
                const errors = []

                for (let i = 1; i < data.length; i++) {
                    const row = data[i] as any[]
                    if (!row || row.length === 0) continue

                    // Sütun sırası: Ad Soyad, Şube, Veli Adı, Veli Telefon, Veresiye Limiti
                    const full_name = (row[0] || '').toString().trim()
                    const class_branch = (row[1] || '').toString().trim()
                    const parent_name = (row[2] || '').toString().trim() || null
                    const parent_phone_raw = (row[3] || '').toString().trim()
                    const credit_limit = parseFloat(row[4]) || 0

                    // Zorunlu alanlar kontrolü
                    if (!full_name || !class_branch) {
                        errors.push(`Satır ${i + 1}: Ad Soyad ve Şube zorunludur`)
                        continue
                    }

                    // Telefon numarasını temizle (sadece rakamlar)
                    let cleanPhone = null
                    if (parent_phone_raw) {
                        const phoneNumbers = parent_phone_raw.replace(/\D/g, '')
                        if (phoneNumbers.startsWith('90') && phoneNumbers.length > 2) {
                            cleanPhone = phoneNumbers.substring(2)
                        } else if (phoneNumbers.startsWith('0')) {
                            cleanPhone = phoneNumbers.substring(1)
                        } else {
                            cleanPhone = phoneNumbers.substring(0, 10)
                        }
                        if (cleanPhone.length < 10) cleanPhone = null // Geçersizse null yap
                    }

                    // Otomatik kart ID oluştur (toplu yüklemede kart ID verilmez)
                    let cardId = generateCardId()
                    let attempts = 0
                    // Benzersizlik kontrolü (maksimum 10 deneme)
                    while (attempts < 10) {
                        const { data: existing } = await supabase
                            .from('students')
                            .select('id')
                            .eq('nfc_card_id', cardId)
                            .single()
                        if (!existing) break
                        cardId = generateCardId()
                        attempts++
                    }

                    students.push({
                        school_id: targetSchoolId,
                        full_name: full_name.toUpperCase(), // Büyük harfe çevir
                        class_branch: class_branch.toUpperCase(), // Büyük harfe çevir
                        parent_name: parent_name ? parent_name.toUpperCase() : null, // Büyük harfe çevir
                        parent_phone: cleanPhone,
                        nfc_card_id: cardId,
                        wallet_balance: 0,
                        credit_limit: credit_limit
                    })
                }

                if (students.length === 0) {
                    alert('Kaydedilecek geçerli öğrenci bulunamadı.')
                    return
                }

                // Toplu ekleme
                const { error: insertError } = await supabase
                    .from('students')
                    .insert(students)

                if (insertError) {
                    console.error('Toplu ekleme hatası:', insertError)
                    alert(`Hata: ${insertError.message}\n\n${errors.length > 0 ? 'Uyarılar:\n' + errors.join('\n') : ''}`)
                } else {
                    const successMsg = `✅ ${students.length} adet öğrenci başarıyla eklendi!`
                    const errorMsg = errors.length > 0 ? `\n\n⚠️ ${errors.length} satır atlandı:\n${errors.join('\n')}` : ''
                    alert(successMsg + errorMsg)
                    fetchData() // Listeyi yenile
                }
            } catch (error) {
                console.error('Excel okuma hatası:', error)
                alert('Excel dosyası okunurken bir hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'))
            }
        }
        reader.readAsBinaryString(file)

        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    // Bakiye Yükle
    const handleDeposit = async () => {
        if (!depositModal.student || !depositAmount || isDepositSubmitting) return

        try {
            setIsDepositSubmitting(true)
            const amount = parseFloat(depositAmount)
            if (isNaN(amount) || amount <= 0) {
                alert('Geçerli bir tutar giriniz.')
                return
            }

            const result = await addStudentBalance(depositModal.student.id, amount)

            if (result.success) {
                alert('✅ ' + result.message)
                setDepositModal({ open: false, student: null })
                setDepositAmount('')
                fetchData()
            } else {
                alert('❌ Hata: ' + result.error)
            }
        } catch (error: any) {
            alert('Beklenmedik Hata: ' + error.message)
        } finally {
            setIsDepositSubmitting(false)
        }
    }

    // Öğrenci Sil
    const handleDelete = async (id: string) => {
        if (!confirm('Bu öğrenciyi silmek istediğinize emin misiniz?')) return

        try {
            const { error } = await supabase.from('students').delete().eq('id', id)
            if (error) throw error
            fetchData()
        } catch (error: any) {
            alert('Silme hatası: ' + error.message)
        }
    }

    // GEÇMİŞ İŞLEMLERİ AÇ
    const openHistoryModal = async (student: any) => {
        setHistoryModal({ open: true, student, transactions: [] })

        try {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('student_id', student.id)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .order('created_at', { ascending: false })

            if (error) throw error
            setHistoryModal(prev => ({ ...prev, transactions: data || [] }))
        } catch (error) {
            console.error('Geçmiş hatası:', error)
            alert('Geçmiş verileri çekilemedi.')
        }
    }

    // PDF İNDİR (Geçmiş)
    const handleDownloadHistoryPdf = () => {
        const { student, transactions } = historyModal
        if (!student || transactions.length === 0) return

        try {
            const doc = new jsPDF()

            const latinify = (str: string) => {
                if (!str) return ''
                const mapping: { [key: string]: string } = { 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C' }
                return str.split('').map(char => mapping[char] || char).join('')
            }

            doc.setFontSize(18)
            doc.text(`${latinify(schoolName)} - Ogrenci Harcama Dokumu`, 14, 22)

            doc.setFontSize(12)
            doc.text(`Ogrenci: ${latinify(student.full_name)}`, 14, 32)
            doc.text(`Sinif: ${latinify(student.class_branch)}`, 14, 38)
            doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 44)
            doc.text(`Donem: Son 1 Ay`, 14, 50)

            const tableBody = transactions.map(t => {
                let productStr = ''
                if (t.items_json && Array.isArray(t.items_json)) {
                    productStr = t.items_json.map((i: any) => `${latinify(i.name || 'Urun')} (x${i.quantity || 1})`).join(', ')
                } else if (t.items_json && t.items_json.note) {
                    productStr = latinify(t.items_json.note)
                } else {
                    productStr = 'Islem Detayi Yok'
                }

                return [
                    new Date(t.created_at).toLocaleString('tr-TR'),
                    t.transaction_type === 'deposit' ? 'Para Yukleme' : 'Harcama',
                    productStr,
                    `${t.amount.toFixed(2)} TL`
                ]
            })

            autoTable(doc, {
                startY: 56,
                head: [['Tarih', 'Islem Turu', 'Detay', 'Tutar']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
            })

            doc.save(`${latinify(student.full_name).replace(/\s+/g, '_')}_Ekstre.pdf`)

        } catch (error) {
            console.error('PDF hatası:', error)
            alert('PDF oluşturulamadı.')
        }
    }

    // TOPLU PDF İNDİR - Tüm Öğrencilerin Erişim Kodları
    const handleDownloadAllAccessCodesPdf = () => {
        if (filteredStudents.length === 0) {
            alert('PDF oluşturmak için en az bir öğrenci olmalı.')
            return
        }

        try {
            const doc = new jsPDF()

            const latinify = (str: string) => {
                if (!str) return ''
                const mapping: { [key: string]: string } = { 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C' }
                return str.split('').map(char => mapping[char] || char).join('')
            }

            doc.setFontSize(18)
            doc.text(`${latinify(schoolName)} - Ogrenci Erisim Kodlari`, 14, 22)

            doc.setFontSize(12)
            doc.text(`Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 32)
            doc.text(`Toplam Ogrenci: ${filteredStudents.length}`, 14, 38)

            const tableBody = filteredStudents.map((student, index) => [
                (index + 1).toString(),
                latinify(student.full_name || ''),
                latinify(student.class_branch || ''),
                student.access_code || 'YOK',
                student.student_number || '-'
            ])

            autoTable(doc, {
                startY: 44,
                head: [['Sira', 'Ad Soyad', 'Sinif', 'Erisim Kodu', 'Ogrenci No']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
                styles: { fontSize: 9 },
                columnStyles: {
                    0: { cellWidth: 15 },
                    1: { cellWidth: 60 },
                    2: { cellWidth: 30 },
                    3: { cellWidth: 40, fontStyle: 'bold' },
                    4: { cellWidth: 35 }
                }
            })

            doc.save(`${latinify(schoolName).replace(/\s+/g, '_')}_Erisim_Kodlari_${new Date().toISOString().split('T')[0]}.pdf`)

        } catch (error) {
            console.error('Toplu PDF hatası:', error)
            alert('PDF oluşturulamadı.')
        }
    }

    // KART YAZDIR (PDF) - Öğrenci Kantin Kartı
    const handlePrintCard = (student: any) => {
        if (!student || !student.access_code) {
            alert('Bu öğrencinin erişim kodu henüz oluşturulmamış. Lütfen bekleyin.')
            return
        }

        try {
            const doc = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [85.6, 53.98] // Kredi kartı boyutu
            })

            const latinify = (str: string) => {
                if (!str) return ''
                const mapping: { [key: string]: string } = { 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C' }
                return str.split('').map(char => mapping[char] || char).join('')
            }

            // Arka plan rengi (mavi tonları)
            doc.setFillColor(30, 58, 138) // indigo-800
            doc.rect(0, 0, 85.6, 53.98, 'F')

            // Okul adı (üst)
            doc.setTextColor(255, 255, 255)
            doc.setFontSize(10)
            doc.setFont('helvetica', 'bold')
            doc.text(latinify(schoolName).toUpperCase(), 42.8, 8, { align: 'center' })

            // Öğrenci adı (orta, büyük)
            doc.setFontSize(14)
            doc.setFont('helvetica', 'bold')
            doc.text(latinify(student.full_name).toUpperCase(), 42.8, 20, { align: 'center' })

            // Şube (öğrenci adının altı)
            if (student.class_branch) {
                doc.setFontSize(10)
                doc.setFont('helvetica', 'normal')
                doc.text(latinify(student.class_branch).toUpperCase(), 42.8, 26, { align: 'center' })
            }

            // ERİŞİM KODU (ÇOK BÜYÜK, ORTADA)
            doc.setFontSize(28)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(255, 255, 255)
            doc.text(student.access_code, 42.8, 38, { align: 'center' })

            // Alt not
            doc.setFontSize(7)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(200, 200, 200)
            doc.text('Bu kodu uygulamaya giriniz', 42.8, 45, { align: 'center' })

            // Dosya adı
            const fileName = `${latinify(student.full_name).replace(/\s+/g, '_')}_Kart.pdf`
            doc.save(fileName)

        } catch (error) {
            console.error('Kart PDF hatası:', error)
            alert('Kart PDF oluşturulamadı.')
        }
    }

    // --- DÜZENLEME İŞLEMLERİ ---
    const openEditModal = (student: any) => {
        setEditModal({ open: true, student })
        // Telefon numarasını formatla (veritabanından gelen sadece rakamlar olabilir)
        const phoneToFormat = student.parent_phone || ''
        const formattedPhone = phoneToFormat ? formatPhoneNumber(phoneToFormat) : '+90 ('

        setEditForm({
            full_name: student.full_name,
            class_branch: student.class_branch,
            parent_name: student.parent_name || '',
            parent_phone: formattedPhone,
            nfc_card_id: student.nfc_card_id || '',
            credit_limit: student.credit_limit || 0
        })
    }

    const handleEditSave = async () => {
        if (!editModal.student) return

        const { error } = await supabase.from('students').update({
            full_name: editForm.full_name.toUpperCase(), // Büyük harfe çevir
            class_branch: editForm.class_branch.toUpperCase(), // Büyük harfe çevir
            parent_name: editForm.parent_name?.toUpperCase() || null, // Büyük harfe çevir
            parent_phone: extractPhoneNumbers(editForm.parent_phone), // Sadece rakamları kaydet
            nfc_card_id: editForm.nfc_card_id,
            credit_limit: editForm.credit_limit
        }).eq('id', editModal.student.id)

        if (error) {
            alert('Güncelleme hatası: ' + error.message)
        } else {
            alert('✅ Öğrenci bilgileri güncellendi!')
            setEditModal({ open: false, student: null })
            fetchData()
        }
    }

    // --- HIZLI EŞLEŞTİRME SİHİRBAZI ---
    const startWizard = () => {
        // Kart ID'si olmayan veya geçici (SKY- ile başlayan) ID'ye sahip öğrencileri filtrele
        const targetStudents = students.filter(s =>
            !s.nfc_card_id || s.nfc_card_id.startsWith('SKY-') || s.nfc_card_id.length > 15 // Uzun ID'ler genelde randomdur
        )

        if (targetStudents.length === 0) {
            alert('Tüm öğrencilerin kart tanımlaması yapılmış görünüyor!')
            return
        }

        setWizardModal({
            open: true,
            currentIndex: 0,
            students: targetStudents
        })
        setWizardInput('')
        setTimeout(() => wizardInputRef.current?.focus(), 100)
    }

    const handleWizardSubmit = async () => {
        if (!wizardInput.trim()) return

        const currentStudent = wizardModal.students[wizardModal.currentIndex]

        // Kart ID çakışma kontrolü
        const { data: existing } = await supabase.from('students')
            .select('id, full_name')
            .eq('nfc_card_id', wizardInput.trim())
            .neq('id', currentStudent.id) // Kendisi hariç
            .single()

        if (existing) {
            alert(`Bu kart zaten "${existing.full_name}" adlı öğrenciye tanımlı!`)
            setWizardInput('')
            return
        }

        // Güncelle
        const { error } = await supabase.from('students')
            .update({ nfc_card_id: wizardInput.trim() })
            .eq('id', currentStudent.id)

        if (error) {
            alert('Hata: ' + error.message)
            return
        }

        // Başarılı
        // Ses efekti eklenebilir: new Audio('/beep.mp3').play()

        if (wizardModal.currentIndex < wizardModal.students.length - 1) {
            // Sonraki öğrenci
            setWizardModal(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
            setWizardInput('')
            setTimeout(() => wizardInputRef.current?.focus(), 100)
        } else {
            // Bitti
            alert('🎉 Harika! Listelenen tüm öğrencilere kart tanımlandı.')
            setWizardModal({ open: false, currentIndex: 0, students: [] })
            fetchData()
        }
    }

    const skipWizardStudent = () => {
        if (wizardModal.currentIndex < wizardModal.students.length - 1) {
            setWizardModal(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }))
            setWizardInput('')
            setTimeout(() => wizardInputRef.current?.focus(), 100)
        } else {
            alert('Listenin sonuna geldiniz.')
            setWizardModal({ open: false, currentIndex: 0, students: [] })
        }
    }


    // Filtreleme ARTIK YOK - Server Side yapılıyor
    // filteredStudents artık direkt students (çünkü serverdan filtrelenip geldi)
    const filteredStudents = students

    if (loading) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                        <p className="text-slate-400">Öğrenci verileri yükleniyor...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Üst Başlık ve Butonlar */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Öğrenci Yönetimi</h1>
                    {schoolName && (
                        <p className="text-sm text-slate-400 mt-1">
                            {schoolName} • {students.length} öğrenci
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => fetchData()}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold"
                        title="Listeyi yenile"
                    >
                        🔄 Yenile
                    </button>
                    <button
                        onClick={startWizard}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold shadow-lg shadow-yellow-900/20 animate-pulse"
                    >
                        <Zap size={18} />
                        Hızlı Kart Eşleştir
                    </button>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />

                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold"
                    >
                        📥 Excel İle Yükle
                    </button>

                    <button
                        onClick={handleDownloadTemplate}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-sm"
                    >
                        📄 Şablon İndir
                    </button>
                </div>
            </div>

            {/* FORM */}
            <div className="bg-slate-800 p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 items-end border border-slate-700">
                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Ad Soyad</label>
                    <input
                        type="text"
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700 uppercase"
                        placeholder="Örn: Ali Veli"
                        style={{ textTransform: 'uppercase' }}
                        value={form.full_name}
                        onChange={e => setForm({ ...form, full_name: e.target.value.toUpperCase() })}
                    />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Şube</label>
                    <input
                        type="text"
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700 uppercase"
                        placeholder="Örn: 5-A"
                        style={{ textTransform: 'uppercase' }}
                        value={form.class_branch}
                        onChange={e => setForm({ ...form, class_branch: e.target.value.toUpperCase() })}
                    />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Veli Adı</label>
                    <input
                        type="text"
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700 uppercase"
                        placeholder="Veli İsmi"
                        style={{ textTransform: 'uppercase' }}
                        value={form.parent_name}
                        onChange={e => setForm({ ...form, parent_name: e.target.value.toUpperCase() })}
                    />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Veli Cep</label>
                    <input
                        type="text"
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        placeholder="+90 (555) 123 45 67"
                        value={form.parent_phone}
                        onChange={e => handlePhoneChange(e.target.value, false)}
                        maxLength={19} // +90 (XXX) XXX XX XX = 19 karakter
                        pattern="[0-9+\s()]*"
                    />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Kart ID (Ops)</label>
                    <input type="text" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700 font-mono text-xs" placeholder="Okutunuz..."
                        value={form.nfc_card_id} onChange={e => setForm({ ...form, nfc_card_id: e.target.value })} />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Veresiye Limiti</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700" placeholder="0"
                        value={form.credit_limit} onChange={e => setForm({ ...form, credit_limit: parseFloat(e.target.value) || 0 })} />
                </div>

                <div className="lg:col-span-1">
                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10 rounded font-bold">
                        + Kaydet
                    </button>
                </div>
            </div>

            {/* ARAMA VE PDF BUTONU */}
            <div className="flex gap-4 mb-4">
                <div className="flex-1 bg-slate-800 p-4 rounded-lg border border-slate-700">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-slate-400">🔍</span>
                        </div>
                        <input
                            type="text"
                            className="w-full bg-slate-900 text-white pl-10 p-3 rounded border border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="Öğrenci Ara (Sunucuda Aranır)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <button
                    onClick={handleDownloadAllAccessCodesPdf}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors"
                    title="Tüm öğrencilerin erişim kodlarını PDF olarak indir"
                >
                    <FileText size={20} />
                    Toplu PDF İndir
                </button>
            </div>

            {/* LİSTE */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400">
                        <tr>
                            <th className="p-4">Ad Soyad</th>
                            <th className="p-4">Şube</th>
                            <th className="p-4">Kart ID (Oto)</th>
                            <th className="p-4">Mobil Giriş</th>
                            <th className="p-4">Veli Bilgisi</th>
                            <th className="p-4">Bakiye</th>
                            <th className="p-4">Limit</th>
                            <th className="p-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="p-4 font-medium text-white">{student.full_name}</td>
                                <td className="p-4"><span className="bg-slate-800 px-2 py-1 rounded text-xs">{student.class_branch}</span></td>
                                <td className="p-4 font-mono text-xs text-yellow-400">{student.nfc_card_id}</td>
                                <td className="p-4">
                                    {student.access_code ? (
                                        <div className="bg-indigo-600/20 border border-indigo-500/50 rounded-lg p-3">
                                            <div className="text-xs text-indigo-400 mb-1 font-semibold">ERİŞİM KODU</div>
                                            <div className="text-2xl font-bold text-indigo-300 font-mono tracking-wider">{student.access_code}</div>
                                        </div>
                                    ) : (
                                        <div className="text-slate-500 text-xs">Kod üretiliyor...</div>
                                    )}
                                </td>
                                <td className="p-4 text-sm">
                                    <div className="text-white">{student.parent_name}</div>
                                    <div className="text-slate-500 text-xs">{student.parent_phone}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`font-bold text-lg ${student.wallet_balance < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                                        ₺{student.wallet_balance}
                                    </span>
                                </td>
                                <td className="p-4 text-slate-400">₺{student.credit_limit || 0}</td>
                                <td className="p-4 text-right space-x-2 flex justify-end">
                                    <button onClick={() => handlePrintCard(student)}
                                        className="bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white px-3 py-1 rounded text-sm transition-colors" title="Kart Yazdır">
                                        <CreditCard size={16} />
                                    </button>
                                    <button onClick={() => setDepositModal({ open: true, student: student })}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded text-sm font-bold" title="Para Yükle">
                                        + ₺
                                    </button>
                                    <button onClick={() => openEditModal(student)}
                                        className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1 rounded text-sm transition-colors" title="Düzenle">
                                        <Pencil size={16} />
                                    </button>
                                    <button onClick={() => openHistoryModal(student)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1 rounded text-sm transition-colors" title="Geçmiş">
                                        <Clock size={16} />
                                    </button>
                                    <button onClick={() => handleDelete(student.id)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-sm" title="Sil">
                                        <X size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr>
                                <td colSpan={8} className="p-8 text-center">
                                    <div className="space-y-2">
                                        <p className="text-slate-400">
                                            {searchTerm ? (
                                                <>Aradığınız kriterde öğrenci bulunamadı.</>
                                            ) : students.length === 0 ? (
                                                <>Henüz kayıtlı öğrenci yok. Yeni öğrenci eklemek için yukarıdaki formu kullanın.</>
                                            ) : (
                                                <>Filtre sonucu: {students.length} öğrenciden hiçbiri eşleşmedi.</>
                                            )}
                                        </p>
                                        {!searchTerm && students.length === 0 && (
                                            <button
                                                onClick={() => fetchData()}
                                                className="mt-4 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm"
                                            >
                                                🔄 Yenile
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* SAYFALAMA KONTROLLERİ */}
                <div className="bg-slate-950 p-4 border-t border-slate-800 flex justify-between items-center text-sm">
                    <div className="text-slate-400">
                        Toplam <span className="text-white font-bold">{totalCount}</span> öğrenci,
                        Şu an <span className="text-white font-bold">{page + 1}</span>. sayfadasınız
                    </div>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0 || loading}
                            onClick={() => setPage(p => p - 1)}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            &larr; Önceki
                        </button>
                        <button
                            disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}
                            onClick={() => setPage(p => p + 1)}
                            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Sonraki &rarr;
                        </button>
                    </div>
                </div>
            </div>

            {/* PARA YÜKLEME POPUP */}
            {depositModal.open && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-xl w-96 border border-slate-600 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Bakiye Yükle</h2>
                        <div className="mb-4">
                            <div className="text-slate-400 text-sm">Öğrenci</div>
                            <div className="text-white font-bold text-lg">{depositModal.student?.full_name}</div>
                        </div>
                        <input type="number" className="w-full bg-slate-900 text-white text-2xl p-3 rounded border border-green-500 mb-4 text-center"
                            placeholder="0.00" autoFocus value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                        <div className="flex gap-3">
                            <button onClick={() => setDepositModal({ open: false, student: null })} disabled={isDepositSubmitting} className="flex-1 bg-slate-700 text-white py-3 rounded-lg disabled:opacity-50">İptal</button>
                            <button onClick={handleDeposit} disabled={isDepositSubmitting} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                                {isDepositSubmitting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>Yükleniyor...</span>
                                    </>
                                ) : (
                                    'Onayla'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DÜZENLEME MODALI */}
            {editModal.open && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-6 rounded-xl w-full max-w-2xl border border-slate-600 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Pencil size={24} className="text-indigo-500" />
                                Öğrenci Düzenle
                            </h2>
                            <button onClick={() => setEditModal({ open: false, student: null })} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Ad Soyad</label>
                                <input type="text" className="w-full bg-slate-900 text-white p-3 rounded border border-slate-700"
                                    style={{ textTransform: 'uppercase' }}
                                    value={editForm.full_name}
                                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Şube</label>
                                <input type="text" className="w-full bg-slate-900 text-white p-3 rounded border border-slate-700"
                                    style={{ textTransform: 'uppercase' }}
                                    value={editForm.class_branch}
                                    onChange={e => setEditForm({ ...editForm, class_branch: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Veli Adı</label>
                                <input type="text" className="w-full bg-slate-900 text-white p-3 rounded border border-slate-700"
                                    style={{ textTransform: 'uppercase' }}
                                    value={editForm.parent_name}
                                    onChange={e => setEditForm({ ...editForm, parent_name: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Veli Cep</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-900 text-white p-3 rounded border border-slate-700"
                                    placeholder="+90 (555) 123 45 67"
                                    value={editForm.parent_phone}
                                    onChange={e => handlePhoneChange(e.target.value, true)}
                                    maxLength={19} // +90 (XXX) XXX XX XX = 19 karakter
                                    pattern="[0-9+\s()]*"
                                />
                            </div>
                            <div className="md:col-span-2 bg-slate-900/50 p-4 rounded border border-slate-700">
                                <label className="block text-sm text-green-400 mb-2 font-bold flex items-center gap-2">
                                    <CreditCard size={16} />
                                    NFC Kart ID (Okutunuz)
                                </label>
                                <div className="flex gap-2">
                                    <input type="text" className="flex-1 bg-slate-950 text-white font-mono text-lg p-3 rounded border border-green-500/50 focus:border-green-500 focus:ring-1 focus:ring-green-500"
                                        value={editForm.nfc_card_id} onChange={e => setEditForm({ ...editForm, nfc_card_id: e.target.value })}
                                        placeholder="Kartı okutun..." autoFocus />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm text-slate-400 mb-1">Veresiye Limiti (₺)</label>
                                <input type="number" className="w-full bg-slate-900 text-white p-3 rounded border border-slate-700"
                                    value={editForm.credit_limit} onChange={e => setEditForm({ ...editForm, credit_limit: parseFloat(e.target.value) || 0 })} />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setEditModal({ open: false, student: null })} className="flex-1 bg-slate-700 text-white py-3 rounded-lg font-bold">İptal</button>
                            <button onClick={handleEditSave} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold">Kaydet</button>
                        </div>
                    </div>
                </div>
            )}

            {/* HIZLI EŞLEŞTİRME SİHİRBAZI */}
            {wizardModal.open && wizardModal.students.length > 0 && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 p-8 rounded-2xl w-full max-w-2xl border border-yellow-500/50 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-slate-700">
                            <div className="h-full bg-yellow-500 transition-all duration-300"
                                style={{ width: `${((wizardModal.currentIndex) / wizardModal.students.length) * 100}%` }}></div>
                        </div>

                        <div className="text-center mb-8 mt-4">
                            <div className="text-yellow-500 font-bold mb-2 flex items-center justify-center gap-2">
                                <Zap size={24} /> HIZLI KART EŞLEŞTİRME MODU
                            </div>
                            <h2 className="text-4xl font-bold text-white mb-2">
                                {wizardModal.students[wizardModal.currentIndex].full_name}
                            </h2>
                            <div className="text-xl text-slate-400">
                                {wizardModal.students[wizardModal.currentIndex].class_branch}
                            </div>
                        </div>

                        <div className="mb-8">
                            <div className="relative">
                                <ScanBarcode className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={32} />
                                <input
                                    ref={wizardInputRef}
                                    type="text"
                                    className="w-full bg-slate-900 text-white text-3xl py-6 pl-16 pr-6 rounded-xl border-2 border-yellow-500 focus:outline-none focus:ring-4 focus:ring-yellow-500/20 text-center font-mono"
                                    placeholder="KARTI OKUTUNUZ..."
                                    value={wizardInput}
                                    onChange={e => setWizardInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleWizardSubmit()}
                                    autoFocus
                                />
                            </div>
                            <p className="text-center text-slate-500 mt-4 text-sm">
                                Kartı okuttuğunuzda otomatik olarak kaydedip bir sonraki öğrenciye geçecektir.
                            </p>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="text-slate-400">
                                İlerleme: <span className="text-white font-bold">{wizardModal.currentIndex + 1}</span> / {wizardModal.students.length}
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setWizardModal({ open: false, currentIndex: 0, students: [] })}
                                    className="px-6 py-3 rounded-lg bg-slate-700 text-white hover:bg-slate-600 font-bold">
                                    Çıkış
                                </button>
                                <button onClick={skipWizardStudent}
                                    className="px-6 py-3 rounded-lg bg-slate-600 text-white hover:bg-slate-500 font-bold">
                                    Atla ⏭️
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* GEÇMİŞ MODALI */}
            {historyModal.open && historyModal.student && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 rounded-xl w-full max-w-3xl border border-slate-600 shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Clock size={24} className="text-blue-500" />
                                    Son 1 Aylık Hareketler
                                </h2>
                                <p className="text-slate-400 text-sm">{historyModal.student.full_name} - {historyModal.student.class_branch}</p>
                            </div>
                            <button onClick={() => setHistoryModal({ open: false, student: null, transactions: [] })} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {historyModal.transactions.length === 0 ? (
                                <div className="text-center text-slate-500 py-10">Son 30 gün içinde işlem bulunamadı.</div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0">
                                        <tr>
                                            <th className="p-3">Tarih</th>
                                            <th className="p-3">Tür</th>
                                            <th className="p-3">Detay</th>
                                            <th className="p-3 text-right">Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {historyModal.transactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-slate-700/50">
                                                <td className="p-3 text-slate-300 text-sm">{new Date(t.created_at).toLocaleString('tr-TR')}</td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${t.transaction_type === 'deposit' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                                        {t.transaction_type === 'deposit' ? 'Yükleme' : 'Harcama'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-300 text-sm">
                                                    {t.items_json && Array.isArray(t.items_json) ? (
                                                        t.items_json.map((i: any) => i.name).join(', ')
                                                    ) : t.items_json?.note || '-'}
                                                </td>
                                                <td className={`p-3 text-right font-bold ${t.transaction_type === 'deposit' ? 'text-green-400' : 'text-white'}`}>
                                                    {t.transaction_type === 'deposit' ? '+' : '-'}₺{t.amount.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-700 flex justify-end bg-slate-800/50">
                            <button
                                onClick={handleDownloadHistoryPdf}
                                disabled={historyModal.transactions.length === 0}
                                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <FileText size={18} />
                                PDF İndir
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
