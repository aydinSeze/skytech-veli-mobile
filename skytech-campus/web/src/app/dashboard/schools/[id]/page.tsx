'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
    School, MapPin, Users, Package, History,
    TrendingUp, Wallet, ArrowLeft, Search, FileSpreadsheet, Lock, ShoppingCart, Truck, DollarSign, Edit2, Download, X
} from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { addSchoolCredit } from '@/actions/school-actions'
import { resetSchoolPin } from '@/actions/school-actions'

export const dynamic = 'force-dynamic'

export default function SchoolDetailsPage() {
    const params = useParams()
    const schoolId = params.id as string
    const supabase = createClient()

    const [school, setSchool] = useState<any>(null)
    const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'students' | 'history' | 'suppliers' | 'expenses' | 'pos'>('overview')
    const [loading, setLoading] = useState(true)

    // Alt Veriler
    const [products, setProducts] = useState<any[]>([])
    const [students, setStudents] = useState<any[]>([])
    const [transactions, setTransactions] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [expenses, setExpenses] = useState<any[]>([])

    // Kredi Modalı
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false)
    const [creditAmount, setCreditAmount] = useState('')
    
    // Düzenleme Modalı
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editForm, setEditForm] = useState({
        authorized_person: '',
        contact_phone: '',
        iban: '',
        tax_office: '',
        tax_number: ''
    })

    useEffect(() => {
        fetchSchoolDetails()
    }, [schoolId])

    const fetchSchoolDetails = async () => {
        setLoading(true)
        try {
            // 1. Okul Bilgisi
            const { data: schoolData, error } = await supabase
                .from('schools')
                .select('*')
                .eq('id', schoolId)
                .single()

            if (error) throw error
            setSchool(schoolData)
            
            // Düzenleme formunu doldur
            setEditForm({
                authorized_person: schoolData.authorized_person || '',
                contact_phone: schoolData.contact_phone || '',
                iban: schoolData.iban || '',
                tax_office: schoolData.tax_office || '',
                tax_number: schoolData.tax_number || ''
            })

            // 2. Diğer verileri paralel çek (Performans optimizasyonu: Spesifik alanlar + limit)
            const [prodRes, studRes, transRes, suppRes, expRes] = await Promise.all([
                supabase.from('products')
                    .select('id, name, barcode, buying_price, selling_price, stock_quantity, supplier_id, company_phone, created_at')
                    .eq('school_id', schoolId)
                    .limit(500), // PERFORMANS: Maksimum 500 ürün
                supabase.from('students')
                    .select('id, full_name, student_number, nfc_card_id, wallet_balance, class_branch, parent_name, parent_phone, credit_limit, is_active, created_at')
                    .eq('school_id', schoolId)
                    .limit(500), // PERFORMANS: Maksimum 500 öğrenci
                supabase.from('transactions')
                    .select('id, amount, transaction_type, created_at, items_json, student_id, personnel_id')
                    .eq('school_id', schoolId)
                    .order('created_at', { ascending: false })
                    .limit(100), // PERFORMANS: Son 100 transaction
                supabase.from('suppliers')
                    .select('id, name, phone, email, address, created_at')
                    .eq('school_id', schoolId)
                    .order('name', { ascending: true })
                    .limit(100), // PERFORMANS: Maksimum 100 tedarikçi
                supabase.from('expenses')
                    .select('id, amount, description, expense_date, category, created_at')
                    .eq('school_id', schoolId)
                    .order('expense_date', { ascending: false })
                    .limit(100) // PERFORMANS: Son 100 gider
            ])

            setProducts(prodRes.data || [])
            setStudents(studRes.data || [])
            setTransactions(transRes.data || [])
            setSuppliers(suppRes.data || [])
            setExpenses(expRes.data || [])

        } catch (error) {
            console.error('Okul detay hatası:', error)
        } finally {
            setLoading(false)
        }
    }

    const [isAddingCredit, setIsAddingCredit] = useState(false)
    const router = useRouter() // Import useRouter from next/navigation

    const handleAddCredit = async () => {
        if (!creditAmount) return
        const amount = parseFloat(creditAmount)
        if (isNaN(amount) || amount <= 0) {
            alert('Geçerli bir tutar girin.')
            return
        }

        setIsAddingCredit(true)
        try {
            const result = await addSchoolCredit(schoolId, amount)
            if (result.success) {
                alert('Kredi başarıyla yüklendi.') // Mesajı basitleştirdim veya result.message varsa onu kullanın
                setIsCreditModalOpen(false)
                setCreditAmount('')
                fetchSchoolDetails() // State yenile
                router.refresh() // Server componentleri yenile
            } else {
                alert('Hata: ' + result.error)
            }
        } catch (error) {
            console.error(error)
            alert('Bir hata oluştu.')
        } finally {
            setIsAddingCredit(false)
        }
    }

    const handleDownloadExcel = () => {
        if (students.length === 0) {
            alert('İndirilecek öğrenci verisi yok.')
            return
        }

        const data = students.map(s => ({
            'Ad Soyad': s.full_name,
            'Sınıf': s.class_branch || '-',
            'Kart ID': s.nfc_card_id || '-',
            'Veli Adı': s.parent_name || '-',
            'Veli Telefon': s.parent_phone || '-',
            'Bakiye': s.wallet_balance
        }))

        const ws = XLSX.utils.json_to_sheet(data)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Ogrenciler')
        XLSX.writeFile(wb, `${school.name.replace(/\s+/g, '_')}_Ogrenciler.xlsx`)
    }

    const handleResetPin = async () => {
        if (!confirm('Bu okulun finansal PIN şifresini "0000" olarak sıfırlamak istediğinize emin misiniz?')) return

        const result = await resetSchoolPin(schoolId)
        if (result.success) {
            alert('✅ ' + result.message)
        } else {
            alert('❌ Hata: ' + result.error)
        }
    }

    const handleSaveEdit = async () => {
        try {
            const { error } = await supabase
                .from('schools')
                .update({
                    authorized_person: editForm.authorized_person || null,
                    contact_phone: editForm.contact_phone || null,
                    iban: editForm.iban || null,
                    tax_office: editForm.tax_office || null,
                    tax_number: editForm.tax_number || null
                })
                .eq('id', schoolId)

            if (error) throw error
            alert('✅ Bilgiler başarıyla güncellendi!')
            setIsEditModalOpen(false)
            fetchSchoolDetails()
        } catch (error) {
            console.error('Güncelleme hatası:', error)
            alert('❌ Güncelleme sırasında bir hata oluştu.')
        }
    }

    // Türkçe karakterleri latinize et
    const latinify = (str: string) => {
        if (!str) return ''
        const mapping: { [key: string]: string } = {
            'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U', 'ş': 's', 'Ş': 'S',
            'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
        }
        return str.split('').map(char => mapping[char] || char).join('')
    }

    const handleDownloadPDF = () => {
        const doc = new jsPDF()
        
        doc.setFontSize(18)
        doc.text(latinify(`${school.name} - Okul Bilgileri`), 14, 22)
        
        doc.setFontSize(12)
        doc.text(latinify(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`), 14, 30)
        
        const tableData = [
            [latinify('Okul Adi'), latinify(school.name || '-')],
            [latinify('Adres'), latinify(school.address || '-')],
            [latinify('Yetkili Adi Soyadi'), latinify(school.authorized_person || '-')],
            [latinify('Yetkili Telefonu'), school.contact_phone || '-'],
            ['IBAN', school.iban || '-'],
            [latinify('Vergi Dairesi'), latinify(school.tax_office || '-')],
            [latinify('Vergi No / T.C.'), school.tax_number || '-'],
            [latinify('Sistem Kredisi'), `TL ${(school.system_credit || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
        ]
        
        autoTable(doc, {
            startY: 40,
            head: [[latinify('Alan'), latinify('Deger')]],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
            styles: { fontSize: 10 },
            didParseCell: function (data: any) {
                if (data.cell.text) {
                    data.cell.text = data.cell.text.map((t: any) => {
                        if (typeof t === 'string') {
                            return latinify(t)
                        }
                        return t
                    })
                }
            }
        })
        
        doc.save(`${latinify(school.name)}_Okul_Bilgileri.pdf`)
    }

    if (loading) return <div className="p-10 text-center text-slate-500">Yükleniyor...</div>
    if (!school) return <div className="p-10 text-center text-red-500">Okul bulunamadı.</div>

    return (
        <div className="p-8 space-y-8">
            {/* BAŞLIK */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard/schools" className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        {school.name}
                        {!school.is_active && <span className="text-sm bg-red-600 px-2 py-1 rounded text-white">PASİF</span>}
                    </h1>
                    <p className="text-slate-400 flex items-center gap-2 mt-1">
                        <MapPin size={16} /> {school.address}
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-xs text-slate-500">Sistem Kredisi</div>
                        <div className={`text-2xl font-bold ${(school.system_credit || 0) <= 0 ? 'text-red-500' : 'text-green-400'}`}>
                            ₺{(school.system_credit || 0).toLocaleString('tr-TR')}
                        </div>
                    </div>
                    <button
                        onClick={() => alert('Rapor indirme özelliği yakında eklenecek.')}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                    >
                        <FileSpreadsheet size={20} /> Rapor
                    </button>
                    <button
                        onClick={() => setIsCreditModalOpen(true)}
                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-green-900/20"
                    >
                        <Wallet size={20} /> Kredi Yükle
                    </button>
                </div>
            </div>

            {/* SEKMELER */}
            <div className="border-b border-slate-800 flex gap-6 overflow-x-auto">
                <button onClick={() => setActiveTab('overview')} className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'overview' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Genel Bakış
                    {activeTab === 'overview' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('pos')} className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'pos' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Kasa / Satış
                    {activeTab === 'pos' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('products')} className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'products' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Ürünler ({products.length})
                    {activeTab === 'products' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('students')} className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'students' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Öğrenciler ({students.length})
                    {activeTab === 'students' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('suppliers')} className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'suppliers' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Firmalar ({suppliers.length})
                    {activeTab === 'suppliers' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('expenses')} className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'expenses' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    Giderler ({expenses.length})
                    {activeTab === 'expenses' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full"></div>}
                </button>
                <button onClick={() => setActiveTab('history')} className={`pb-4 px-2 font-medium transition-colors relative whitespace-nowrap ${activeTab === 'history' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    İşlem Geçmişi
                    {activeTab === 'history' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full"></div>}
                </button>
            </div>

            {/* İÇERİK */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 min-h-[400px]">

                {/* GENEL BAKIŞ */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <div className="flex items-center gap-3 mb-2 text-slate-400">
                                <Users size={20} /> Toplam Öğrenci
                            </div>
                            <div className="text-3xl font-bold text-white">{students.length}</div>
                        </div>
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <div className="flex items-center gap-3 mb-2 text-slate-400">
                                <Package size={20} /> Toplam Ürün
                            </div>
                            <div className="text-3xl font-bold text-white">{products.length}</div>
                        </div>
                        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                            <div className="flex items-center gap-3 mb-2 text-slate-400">
                                <TrendingUp size={20} /> Son İşlemler
                            </div>
                            <div className="text-3xl font-bold text-white">{transactions.length}</div>
                            <div className="text-xs text-slate-500 mt-1">Son 50 işlem</div>
                        </div>

                        {/* ŞİRKET/FATURA BİLGİLERİ KARTI */}
                        <div className="bg-slate-800 p-6 rounded-xl border border-indigo-900/30 col-span-1 md:col-span-3">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3 text-indigo-400">
                                    <School size={20} /> Şirket/Fatura Bilgileri
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDownloadPDF}
                                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
                                    >
                                        <Download size={16} /> PDF İndir
                                    </button>
                                    <button
                                        onClick={() => setIsEditModalOpen(true)}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg font-bold text-sm flex items-center gap-2"
                                    >
                                        <Edit2 size={16} /> Düzenle
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">Yetkili Adı Soyadı</div>
                                    <div className="text-white font-medium">{school.authorized_person || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">Yetkili Telefonu</div>
                                    <div className="text-white font-medium">{school.contact_phone || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">IBAN</div>
                                    <div className="text-white font-mono text-sm">{school.iban || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">Vergi Dairesi</div>
                                    <div className="text-white font-medium">{school.tax_office || '-'}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-slate-500 uppercase mb-1">Vergi No / T.C.</div>
                                    <div className="text-white font-medium">{school.tax_number || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* GÜVENLİK YÖNETİMİ KARTI */}
                        <div className="bg-slate-800 p-6 rounded-xl border border-red-900/30 col-span-1 md:col-span-3">
                            <div className="flex items-center gap-3 mb-4 text-red-400">
                                <Lock size={20} /> Güvenlik Yönetimi
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-white font-bold">Finansal PIN Sıfırlama</h3>
                                    <p className="text-sm text-slate-400">Kantincinin unuttuğu şifreyi <b>0000</b> olarak sıfırlar.</p>
                                </div>
                                <button
                                    onClick={handleResetPin}
                                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg hover:shadow-red-900/20 transition-all"
                                >
                                    PIN'i Sıfırla (0000)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ÜRÜNLER - İFRAME İLE AYRI SAYFA */}
                {activeTab === 'products' && (
                    <iframe 
                        src={`/dashboard/schools/${schoolId}/products?schoolId=${schoolId}`}
                        className="w-full h-[800px] border-0 rounded-lg"
                        title="Ürünler"
                    />
                )}

                {/* ÖĞRENCİLER - İFRAME İLE AYRI SAYFA */}
                {activeTab === 'students' && (
                    <iframe 
                        src={`/dashboard/schools/${schoolId}/students?schoolId=${schoolId}`}
                        className="w-full h-[800px] border-0 rounded-lg"
                        title="Öğrenciler"
                    />
                )}

                {/* KASA / SATIŞ */}
                {activeTab === 'pos' && (
                    <div className="text-center py-20">
                        <ShoppingCart size={64} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Kasa / Satış Paneli</h3>
                        <p className="text-slate-400 mb-6">Bu okul için POS paneline yönlendiriliyorsunuz...</p>
                        <Link href={`/canteen/pos?schoolId=${schoolId}`} className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-bold transition-colors">
                            POS Paneline Git →
                        </Link>
                    </div>
                )}

                {/* FİRMALAR - İFRAME İLE AYRI SAYFA */}
                {activeTab === 'suppliers' && (
                    <iframe 
                        src={`/canteen/suppliers?schoolId=${schoolId}`}
                        className="w-full h-[800px] border-0 rounded-lg"
                        title="Firmalar"
                    />
                )}

                {/* GİDERLER - İFRAME İLE AYRI SAYFA */}
                {activeTab === 'expenses' && (
                    <iframe 
                        src={`/canteen/expenses?schoolId=${schoolId}`}
                        className="w-full h-[800px] border-0 rounded-lg"
                        title="Giderler"
                    />
                )}

                {/* İŞLEM GEÇMİŞİ */}
                {activeTab === 'history' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
                                <tr>
                                    <th className="px-4 py-3">Tarih</th>
                                    <th className="px-4 py-3">Tutar</th>
                                    <th className="px-4 py-3">İşlem Tipi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {transactions.map(t => (
                                    <tr key={t.id} className="hover:bg-slate-800/30">
                                        <td className="px-4 py-3 text-slate-400 text-sm">
                                            {new Date(t.created_at).toLocaleString('tr-TR')}
                                        </td>
                                        <td className="px-4 py-3 font-bold text-white">₺{t.amount}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs px-2 py-1 rounded ${t.transaction_type === 'purchase' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                {t.transaction_type === 'purchase' ? 'Harcama' : 'Yükleme'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {transactions.length === 0 && (
                            <div className="text-center py-10 text-slate-500">
                                İşlem geçmişi bulunamadı.
                            </div>
                        )}
                    </div>
                )}

            </div>

            {/* DÜZENLEME MODALI */}
            {isEditModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-8 rounded-2xl w-full max-w-2xl border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Şirket/Fatura Bilgilerini Düzenle</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Yetkili Adı Soyadı</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                    value={editForm.authorized_person}
                                    onChange={(e) => setEditForm({ ...editForm, authorized_person: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Yetkili Telefonu</label>
                                <input
                                    type="tel"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                    value={editForm.contact_phone}
                                    onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">IBAN (TR ile başlamalı)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500 font-mono"
                                    value={editForm.iban}
                                    onChange={(e) => {
                                        let value = e.target.value.toUpperCase().replace(/\s/g, '')
                                        if (value && !value.startsWith('TR')) {
                                            value = 'TR' + value.replace(/^TR/, '')
                                        }
                                        setEditForm({ ...editForm, iban: value })
                                    }}
                                    placeholder="TR00 0000 0000 0000 0000 0000 00"
                                    maxLength={34}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Vergi Dairesi</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                    value={editForm.tax_office}
                                    onChange={(e) => setEditForm({ ...editForm, tax_office: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Vergi No / T.C.</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg focus:outline-none focus:border-indigo-500"
                                    value={editForm.tax_number}
                                    onChange={(e) => setEditForm({ ...editForm, tax_number: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-bold transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSaveEdit}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold transition-colors"
                                >
                                    Kaydet
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
