'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, Search, Edit2, Trash2, User, Briefcase, CreditCard, X, Save, MoreVertical, Wallet, Banknote, Clock, FileText } from 'lucide-react'
import { addPersonnelBalance, updatePersonnel, deletePersonnel, addPersonnel } from '@/actions/personnel-actions'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Tipler
interface Personnel {
    id: string
    full_name: string
    role: string
    nfc_card_id?: string
    wallet_balance: number
    credit_limit: number
    is_active: boolean
}

export const dynamic = 'force-dynamic'

export default function PersonnelPage() {
    const [personnel, setPersonnel] = useState<Personnel[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [schoolName, setSchoolName] = useState('SkyTech Campus') // Varsayılan
    const supabase = createClient()

    // Modals State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [isDepositModalOpen, setIsDepositModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false) // Yeni: Geçmiş Modalı
    const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [historyTransactions, setHistoryTransactions] = useState<any[]>([]) // Yeni: Geçmiş İşlemler

    // Forms
    const [addForm, setAddForm] = useState({
        full_name: '',
        role: 'Öğretmen',
        nfc_card_id: '',
        credit_limit: '0'
    })
    const [depositAmount, setDepositAmount] = useState('')
    const [editForm, setEditForm] = useState({
        full_name: '',
        role: '',
        nfc_card_id: '',
        credit_limit: '0'
    })
    const [submitting, setSubmitting] = useState(false)

    // Verileri Çek
    useEffect(() => {
        fetchPersonnel()
    }, [])

    // Dışarı tıklayınca dropdown kapat
    useEffect(() => {
        const handleClickOutside = () => setActiveDropdown(null)
        window.addEventListener('click', handleClickOutside)
        return () => window.removeEventListener('click', handleClickOutside)
    }, [])

    const fetchPersonnel = async () => {
        try {
            // 1. Kullanıcının Okul ID'sini Çek (Yönetici için URL parametresinden)
            const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
            const urlSchoolId = urlParams.get('schoolId')
            let targetSchoolId: string | null = null

            if (urlSchoolId) {
                // Yönetici modu - URL'den schoolId al
                targetSchoolId = urlSchoolId
                
                // Okul Adını Çek
                const { data: school } = await supabase.from('schools').select('name').eq('id', urlSchoolId).single()
                if (school) setSchoolName(school.name)

                const { data, error } = await supabase
                    .from('school_personnel')
                    .select('*')
                    .eq('school_id', urlSchoolId)
                    .order('full_name')

                if (error) {
                    console.error('Personel çekme hatası:', error)
                    throw error
                }
                
                setPersonnel(data || [])
            } else {
                // Normal kullanıcı - Profile'dan al
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
                if (!profile?.school_id) return

                targetSchoolId = profile.school_id

                // Okul Adını Çek
                const { data: school } = await supabase.from('schools').select('name').eq('id', profile.school_id).single()
                if (school) setSchoolName(school.name)

                const { data, error } = await supabase
                    .from('school_personnel')
                    .select('*')
                    .eq('school_id', profile.school_id)
                    .order('full_name')

                if (error) {
                    console.error('Personel çekme hatası:', error)
                    throw error
                }
                
                console.log(`✅ ${data?.length || 0} adet personel bulundu (Okul ID: ${profile.school_id})`)
                setPersonnel(data || [])
            }
        } catch (error) {
            console.error('Personel çekilirken hata:', error)
        } finally {
            setLoading(false)
        }
    }

    // Personel Ekle
    const handleAddPersonnel = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            // Validasyon
            const fullName = addForm.full_name?.trim() || ''
            if (!fullName) {
                alert('Lütfen Ad Soyad bilgisini girin!')
                setSubmitting(false)
                return
            }

            const formData = new FormData()
            formData.append('full_name', fullName.toUpperCase()) // Büyük harfe çevir
            formData.append('role', addForm.role)
            formData.append('credit_limit', addForm.credit_limit)
            if (addForm.nfc_card_id) formData.append('nfc_card_id', addForm.nfc_card_id)

            const result = await addPersonnel(formData)

            if (result.success) {
                alert('Personel başarıyla eklendi!')
                setIsAddModalOpen(false)
                setAddForm({ full_name: '', role: 'Öğretmen', nfc_card_id: '', credit_limit: '0' })
                fetchPersonnel()
            } else {
                alert('Hata: ' + result.error)
            }

        } catch (error: any) {
            console.error('Ekleme hatası:', error)
            alert('Hata: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Bakiye Yükle
    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPersonnel || !depositAmount) return
        setSubmitting(true)

        try {
            const result = await addPersonnelBalance(selectedPersonnel.id, parseFloat(depositAmount))

            if (result.success) {
                alert('Bakiye başarıyla yüklendi')
                setIsDepositModalOpen(false)
                setDepositAmount('')
                fetchPersonnel()
            } else {
                alert('Hata: ' + result.error)
            }
        } catch (error: any) {
            console.error('Bakiye yükleme hatası:', error)
            alert('Beklenmedik bir hata oluştu: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Personel Güncelle
    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedPersonnel) return
        setSubmitting(true)

        try {
            const formData = new FormData()
            formData.append('id', selectedPersonnel.id)
            formData.append('full_name', editForm.full_name.trim().toUpperCase()) // Büyük harfe çevir
            formData.append('role', editForm.role)
            formData.append('credit_limit', editForm.credit_limit)
            if (editForm.nfc_card_id) formData.append('nfc_card_id', editForm.nfc_card_id)

            const result = await updatePersonnel(formData)

            if (result.success) {
                alert('Personel güncellendi')
                setIsEditModalOpen(false)
                fetchPersonnel()
            } else {
                alert('Hata: ' + result.error)
            }
        } catch (error: any) {
            console.error('Güncelleme hatası:', error)
            alert('Beklenmedik bir hata oluştu: ' + error.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Personel Sil
    const handleDelete = async (id: string) => {
        if (!confirm('Bu personeli silmek istediğinize emin misiniz?')) return

        try {
            const result = await deletePersonnel(id)
            if (result.success) {
                fetchPersonnel()
            } else {
                alert('Hata: ' + result.error)
            }
        } catch (error: any) {
            console.error('Silme hatası:', error)
            alert('Beklenmedik bir hata oluştu: ' + error.message)
        }
    }

    // Edit Modalını Aç
    const openEditModal = (p: Personnel) => {
        setSelectedPersonnel(p)
        setEditForm({
            full_name: p.full_name,
            role: p.role,
            nfc_card_id: p.nfc_card_id || '',
            credit_limit: p.credit_limit.toString()
        })
        setIsEditModalOpen(true)
        setActiveDropdown(null)
    }

    // Deposit Modalını Aç
    const openDepositModal = (p: Personnel) => {
        setSelectedPersonnel(p)
        setIsDepositModalOpen(true)
        setActiveDropdown(null)
    }

    // Geçmiş Modalını Aç ve Verileri Çek
    const openHistoryModal = async (p: Personnel) => {
        setSelectedPersonnel(p)
        setIsHistoryModalOpen(true)
        setActiveDropdown(null)
        setHistoryTransactions([]) // Önce temizle

        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('personnel_id', p.id) // Personel ID'ye göre filtrele
                .order('created_at', { ascending: false })
                .limit(20) // Son 20 işlem

            if (error) throw error
            setHistoryTransactions(data || [])
        } catch (error) {
            console.error('Geçmiş çekilemedi:', error)
            alert('Geçmiş işlemler yüklenirken hata oluştu.')
        }
    }

    // PDF İndir
    const handleDownloadHistoryPdf = () => {
        if (!selectedPersonnel || historyTransactions.length === 0) return

        try {
            const doc = new jsPDF()

            // Türkçe karakter desteği için basit bir font ayarı veya latinize işlemi gerekebilir
            // Şimdilik standart font ile devam ediyoruz, karakter sorunu olursa latinify fonksiyonu eklenebilir.
            // (Dashboard'daki latinify fonksiyonunu buraya da alabiliriz ama şimdilik basit tutalım)

            const latinify = (str: string) => {
                const mapping: { [key: string]: string } = { 'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C' }
                return str.split('').map(char => mapping[char] || char).join('')
            }

            doc.setFontSize(18)
            doc.text(`${latinify(schoolName)} - Personel Hesap Ekstresi`, 14, 22)

            doc.setFontSize(12)
            doc.text(`Personel: ${latinify(selectedPersonnel.full_name)}`, 14, 32)
            doc.text(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`, 14, 38)
            doc.text(`Guncel Bakiye: ${selectedPersonnel.wallet_balance} TL`, 14, 44)

            const tableBody = historyTransactions.map(t => {
                let productStr = ''
                if (t.items_json && Array.isArray(t.items_json)) {
                    productStr = t.items_json.map((i: any) => `${latinify(i.name)} (x${i.quantity})`).join(', ')
                } else {
                    productStr = 'Islem Detayi Yok'
                }

                return [
                    new Date(t.created_at).toLocaleString('tr-TR'),
                    productStr,
                    `${t.amount.toFixed(2)} TL`
                ]
            })

            autoTable(doc, {
                startY: 50,
                head: [['Tarih', 'Islem / Urunler', 'Tutar']],
                body: tableBody,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185] },
            })

            doc.save(`${latinify(selectedPersonnel.full_name).replace(/\s+/g, '_')}_Ekstre.pdf`)

        } catch (error) {
            console.error('PDF oluşturma hatası:', error)
            alert('PDF oluşturulurken bir hata meydana geldi.')
        }
    }

    // Filtreleme
    const filteredPersonnel = personnel.filter(p =>
        p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.role.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-8 space-y-8 text-slate-200">
            {/* Üst Başlık */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Personel Yönetimi</h1>
                    <p className="text-slate-400">Öğretmen ve idari personelin hesaplarını yönetin.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-900/20 font-bold"
                >
                    <Plus size={20} />
                    Yeni Personel Ekle
                </button>
            </div>

            {/* Arama */}
            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 relative">
                <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                    type="text"
                    placeholder="İsim veya görev ile ara..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Tablo */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-visible shadow-xl pb-24">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950/50 text-slate-400 uppercase text-xs font-semibold tracking-wider">
                        <tr>
                            <th className="p-6">Personel</th>
                            <th className="p-6">Görev</th>
                            <th className="p-6">Bakiye</th>
                            <th className="p-6">Veresiye Limiti</th>
                            <th className="p-6 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500 animate-pulse">Yükleniyor...</td></tr>
                        ) : filteredPersonnel.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">Kayıtlı personel bulunamadı.</td></tr>
                        ) : (
                            filteredPersonnel.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-800/50 transition-colors group relative">
                                    <td className="p-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                <User size={20} />
                                            </div>
                                            <span className="font-bold text-white">{p.full_name}</span>
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2 text-slate-400">
                                            <Briefcase size={16} />
                                            {p.role}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className={`font-bold text-lg ${p.wallet_balance < 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                                            ₺{p.wallet_balance.toLocaleString('tr-TR')}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <div className="flex items-center gap-2 text-slate-400 bg-slate-800/50 px-3 py-1 rounded-lg w-fit border border-slate-700">
                                            <CreditCard size={14} />
                                            ₺{p.credit_limit.toLocaleString('tr-TR')}
                                        </div>
                                    </td>
                                    <td className="p-6 text-right relative">
                                        <div className="flex justify-end">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setActiveDropdown(activeDropdown === p.id ? null : p.id)
                                                }}
                                                className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                                            >
                                                <MoreVertical size={20} />
                                            </button>
                                        </div>

                                        {/* DROPDOWN MENU */}
                                        {activeDropdown === p.id && (
                                            <div className="absolute right-6 top-12 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in duration-100">
                                                <button
                                                    onClick={() => openDepositModal(p)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-2 text-emerald-400 font-medium"
                                                >
                                                    <Wallet size={16} />
                                                    Bakiye Yükle
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(p)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-2 text-slate-300"
                                                >
                                                    <Edit2 size={16} />
                                                    Düzenle
                                                </button>
                                                <button
                                                    onClick={() => openHistoryModal(p)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-700 flex items-center gap-2 text-blue-400"
                                                >
                                                    <Clock size={16} />
                                                    Geçmiş Hareketler
                                                </button>
                                                <div className="h-px bg-slate-700 my-0"></div>
                                                <button
                                                    onClick={() => {
                                                        handleDelete(p.id)
                                                        setActiveDropdown(null)
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-red-900/20 flex items-center gap-2 text-red-400 hover:text-red-300"
                                                >
                                                    <Trash2 size={16} />
                                                    Sil
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL: Yeni Personel Ekle */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Yeni Personel Ekle</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAddPersonnel} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Ad Soyad</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none uppercase"
                                    style={{ textTransform: 'uppercase' }}
                                    placeholder="Örn: Ahmet Yılmaz"
                                    value={addForm.full_name}
                                    onChange={e => setAddForm({ ...addForm, full_name: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Görev / Unvan</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                                    value={addForm.role}
                                    onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                                >
                                    <option value="Öğretmen">Öğretmen</option>
                                    <option value="İdareci">İdareci</option>
                                    <option value="Personel">Personel</option>
                                    <option value="Güvenlik">Güvenlik</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Veresiye Limiti (₺)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                                    placeholder="0"
                                    value={addForm.credit_limit}
                                    onChange={e => setAddForm({ ...addForm, credit_limit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">NFC Kart ID (Opsiyonel)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none font-mono"
                                    placeholder="Kart Okutunuz..."
                                    value={addForm.nfc_card_id}
                                    onChange={e => setAddForm({ ...addForm, nfc_card_id: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={20} />
                                {submitting ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Bakiye Yükle */}
            {isDepositModalOpen && selectedPersonnel && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white">Bakiye Yükle</h2>
                                <p className="text-slate-400 text-sm">{selectedPersonnel.full_name}</p>
                            </div>
                            <button onClick={() => setIsDepositModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleDeposit} className="space-y-6">
                            <div className="relative">
                                <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={24} />
                                <input
                                    required
                                    autoFocus
                                    type="number"
                                    className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl py-4 pl-12 pr-4 text-white text-2xl font-bold text-center focus:border-emerald-500 outline-none shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                                    placeholder="0.00"
                                    value={depositAmount}
                                    onChange={e => setDepositAmount(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/20"
                            >
                                <Wallet size={20} />
                                {submitting ? 'Yükleniyor...' : 'Yükle'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Düzenle */}
            {isEditModalOpen && selectedPersonnel && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Personel Düzenle</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleEdit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Ad Soyad</label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none uppercase"
                                    style={{ textTransform: 'uppercase' }}
                                    value={editForm.full_name}
                                    onChange={e => setEditForm({ ...editForm, full_name: e.target.value.toUpperCase() })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Görev / Unvan</label>
                                <select
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                                    value={editForm.role}
                                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                                >
                                    <option value="Öğretmen">Öğretmen</option>
                                    <option value="İdareci">İdareci</option>
                                    <option value="Personel">Personel</option>
                                    <option value="Güvenlik">Güvenlik</option>
                                    <option value="Diğer">Diğer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Veresiye Limiti (₺)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none"
                                    value={editForm.credit_limit}
                                    onChange={e => setEditForm({ ...editForm, credit_limit: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">NFC Kart ID</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none font-mono"
                                    value={editForm.nfc_card_id}
                                    onChange={e => setEditForm({ ...editForm, nfc_card_id: e.target.value })}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl mt-4 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Save size={20} />
                                {submitting ? 'Güncelleniyor...' : 'Güncelle'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Geçmiş Hareketler */}
            {isHistoryModalOpen && selectedPersonnel && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl p-6 animate-in fade-in zoom-in duration-200 max-h-[80vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Clock size={24} className="text-blue-500" />
                                    Geçmiş Hareketler
                                </h2>
                                <p className="text-slate-400 text-sm">{selectedPersonnel.full_name}</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 pr-2">
                            {historyTransactions.length === 0 ? (
                                <div className="text-center text-slate-500 py-10">Henüz işlem kaydı bulunmuyor.</div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-950 text-slate-400 text-xs uppercase sticky top-0">
                                        <tr>
                                            <th className="p-3">Tarih</th>
                                            <th className="p-3">İşlem / Ürünler</th>
                                            <th className="p-3 text-right">Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {historyTransactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-slate-800/50">
                                                <td className="p-3 text-slate-300 text-sm">
                                                    {new Date(t.created_at).toLocaleString('tr-TR')}
                                                </td>
                                                <td className="p-3 text-slate-300 text-sm">
                                                    {t.items_json && Array.isArray(t.items_json) ? (
                                                        <div className="flex flex-col gap-1">
                                                            {t.items_json.map((item: any, idx: number) => (
                                                                <span key={idx} className="text-xs bg-slate-800 px-2 py-1 rounded w-fit">
                                                                    {item.name} (x{item.quantity})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-slate-500">Detay yok</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-bold text-white">
                                                    ₺{t.amount.toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer: PDF Butonu */}
                        <div className="mt-4 pt-4 border-t border-slate-800 flex justify-end">
                            <button
                                onClick={handleDownloadHistoryPdf}
                                disabled={historyTransactions.length === 0}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
