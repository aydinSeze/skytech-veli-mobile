'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useParams } from 'next/navigation'

// ÖNBELLEK İPTALİ (Her girişte taze veri çeksin)
export const dynamic = 'force-dynamic'

export default function SchoolStudentsPage() {
    const params = useParams()
    const schoolId = params?.id as string
    const supabase = createClientComponentClient()
    const [students, setStudents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Para Yükleme Modalı
    const [depositModal, setDepositModal] = useState<{ open: boolean, student: any | null }>({ open: false, student: null })
    const [depositAmount, setDepositAmount] = useState('')

    // Öğrenci Formu
    const [form, setForm] = useState({
        full_name: '',
        class_branch: '', // Yeni: Şube
        parent_name: '', // Yeni: Veli Adı
        parent_phone: '', // Yeni: Veli Tel
        wallet_balance: 0
    })

    // OTOMATİK KART ID ÜRETİCİ
    const generateCardId = () => {
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase()
        return `SKY-${randomPart}`
    }

    const fetchData = async () => {
        if (!schoolId) return
        try {
            setLoading(true)

            // 2. Öğrencileri Çek (Sadece bu okul)
            const { data: studentData, error } = await supabase
                .from('students')
                .select('*')
                .eq('school_id', schoolId)
                .order('created_at', { ascending: false })

            if (error) console.error('Öğrenci çekme hatası:', error)
            setStudents(studentData || [])

        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [schoolId])

    // FİLTRELEME
    const filteredStudents = students.filter(student => {
        const search = searchTerm.toLowerCase()
        return (
            student.full_name?.toLowerCase().includes(search) ||
            student.class_branch?.toLowerCase().includes(search) ||
            student.nfc_card_id?.toLowerCase().includes(search) ||
            student.parent_name?.toLowerCase().includes(search)
        )
    })

    // TEKLİ KAYIT
    const handleSave = async () => {
        if (!schoolId || !form.full_name || !form.class_branch) {
            alert('Lütfen İsim ve Şube bilgilerini girin!')
            return
        }

        const autoCardId = generateCardId()

        // Benzersizlik kontrolü (Basit)
        const { data: existing } = await supabase.from('students').select('id').eq('nfc_card_id', autoCardId).single()
        if (existing) {
            alert('Lütfen tekrar deneyin, ID çakışması oldu.')
            return
        }

        const { error } = await supabase.from('students').insert([{
            school_id: schoolId,
            full_name: form.full_name,
            class_branch: form.class_branch,
            parent_name: form.parent_name,
            parent_phone: form.parent_phone,
            nfc_card_id: autoCardId,
            wallet_balance: form.wallet_balance,
        }])

        if (error) {
            alert('Hata: ' + error.message)
        } else {
            alert(`✅ Öğrenci Kaydedildi!\nKart ID: ${autoCardId}`)
            setForm({
                full_name: '',
                class_branch: '',
                parent_name: '',
                parent_phone: '',
                wallet_balance: 0
            })
            fetchData()
        }
    }

    // EXCEL ŞABLON İNDİRME
    const handleDownloadTemplate = () => {
        const headers = ["Ad Soyad", "Şube", "Veli Adı", "Veli Telefon"]
        const data = [
            ["Ali Yılmaz", "5-A", "Mehmet Yılmaz", "05551234567"],
            ["Ayşe Demir", "6-B", "Fatma Demir", "05321234567"]
        ]

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Ogrenci_Sablon")
        XLSX.writeFile(wb, "SkyTech_Ogrenci_Sablonu.xlsx")
    }

    // EXCEL YÜKLEME
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!schoolId) {
            alert('Okul ID bulunamadı.')
            return
        }

        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][]

                // İlk satır başlık, atla
                const rows = data.slice(1)

                let successCount = 0
                let errorCount = 0

                for (const row of rows) {
                    // Boş satır kontrolü
                    if (!row[0]) continue

                    const fullName = row[0]
                    const branch = row[1]
                    const parentName = row[2]
                    const parentPhone = row[3]
                    // Bakiye sütunu olsa bile okumuyoruz

                    const cardId = generateCardId()

                    const { error } = await supabase.from('students').insert([{
                        school_id: schoolId,
                        full_name: fullName,
                        class_branch: branch,
                        parent_name: parentName,
                        parent_phone: parentPhone,
                        nfc_card_id: cardId,
                        wallet_balance: 0 // GÜVENLİK: Excel yüklemelerinde bakiye her zaman 0
                    }])

                    if (error) {
                        console.error('Satır hatası:', row, error)
                        errorCount++
                    } else {
                        successCount++
                    }
                }

                alert(`İşlem Tamamlandı!\n✅ Başarılı: ${successCount}\n❌ Hatalı: ${errorCount}`)
                fetchData()

            } catch (err) {
                console.error("Excel okuma hatası:", err)
                alert("Excel dosyası okunurken bir hata oluştu.")
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
        }
        reader.readAsBinaryString(file)
    }

    // PARA YÜKLEME
    const handleDeposit = async () => {
        if (!depositModal.student || !depositAmount) return
        const amount = parseFloat(depositAmount)
        if (amount <= 0) return alert('Geçersiz tutar!')

        const newBalance = depositModal.student.wallet_balance + amount

        await supabase.from('students').update({ wallet_balance: newBalance }).eq('id', depositModal.student.id)

        await supabase.from('transactions').insert([{
            student_id: depositModal.student.id,
            amount: amount,
            transaction_type: 'deposit',
            canteen_id: null,
            school_id: schoolId
        }])

        alert(`✅ ${amount} TL Yüklendi!`)
        setDepositModal({ open: false, student: null })
        setDepositAmount('')
        fetchData()
    }

    // SİLME
    const handleDelete = async (id: string) => {
        if (!confirm('Öğrenciyi silmek istiyor musunuz?')) return
        await supabase.from('students').delete().eq('id', id)
        fetchData()
    }

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Öğrenci Yönetimi</h1>
                <div className="flex gap-2">
                    {/* GİZLİ INPUT */}
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
            <div className="bg-slate-900 p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end border border-slate-800">
                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Ad Soyad</label>
                    <input type="text" className="w-full bg-slate-950 text-white p-2 rounded border border-slate-700" placeholder="Örn: Ali Veli"
                        value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Şube</label>
                    <input type="text" className="w-full bg-slate-950 text-white p-2 rounded border border-slate-700" placeholder="Örn: 5-A"
                        value={form.class_branch} onChange={e => setForm({ ...form, class_branch: e.target.value })} />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Veli Adı</label>
                    <input type="text" className="w-full bg-slate-950 text-white p-2 rounded border border-slate-700" placeholder="Veli İsmi"
                        value={form.parent_name} onChange={e => setForm({ ...form, parent_name: e.target.value })} />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Veli Cep</label>
                    <input type="text" className="w-full bg-slate-950 text-white p-2 rounded border border-slate-700" placeholder="0555..."
                        value={form.parent_phone} onChange={e => setForm({ ...form, parent_phone: e.target.value })} />
                </div>

                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Başlangıç Bakiyesi</label>
                    <input type="number" className="w-full bg-slate-950 text-white p-2 rounded border border-slate-700" placeholder="0"
                        value={form.wallet_balance} onChange={e => setForm({ ...form, wallet_balance: parseFloat(e.target.value) })} />
                </div>

                <div className="lg:col-span-1">
                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10 rounded font-bold">
                        + Kaydet
                    </button>
                </div>
            </div>

            {/* ARAMA */}
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400">🔍</span>
                    </div>
                    <input
                        type="text"
                        className="w-full bg-slate-950 text-white pl-10 p-3 rounded border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Öğrenci Ara (İsim, Şube, Kart ID, Veli)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* LİSTE */}
            <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-800">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400">
                        <tr>
                            <th className="p-4">Ad Soyad</th>
                            <th className="p-4">Şube</th>
                            <th className="p-4">Kart ID (Oto)</th>
                            <th className="p-4">Veli Bilgisi</th>
                            <th className="p-4">Bakiye</th>
                            <th className="p-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                                <td className="p-4 font-medium text-white">{student.full_name}</td>
                                <td className="p-4"><span className="bg-slate-800 px-2 py-1 rounded text-xs">{student.class_branch}</span></td>
                                <td className="p-4 font-mono text-xs text-yellow-400">{student.nfc_card_id}</td>
                                <td className="p-4 text-sm">
                                    <div className="text-white">{student.parent_name}</div>
                                    <div className="text-slate-500 text-xs">{student.parent_phone}</div>
                                </td>
                                <td className="p-4 text-green-400 font-bold text-lg">₺{student.wallet_balance}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={() => setDepositModal({ open: true, student: student })}
                                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm font-bold">
                                        + ₺
                                    </button>
                                    <button onClick={() => handleDelete(student.id)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-sm">🗑️</button>
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-500">
                                {searchTerm ? 'Aradığınız kriterde öğrenci bulunamadı.' : 'Henüz kayıtlı öğrenci yok.'}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* PARA YÜKLEME POPUP */}
            {depositModal.open && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-slate-900 p-6 rounded-xl w-96 border border-slate-700 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Bakiye Yükle</h2>
                        <div className="mb-4">
                            <div className="text-slate-400 text-sm">Öğrenci</div>
                            <div className="text-white font-bold text-lg">{depositModal.student?.full_name}</div>
                        </div>
                        <input type="number" className="w-full bg-slate-950 text-white text-2xl p-3 rounded border border-green-500 mb-4 text-center"
                            placeholder="0.00" autoFocus value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                        <div className="flex gap-3">
                            <button onClick={() => setDepositModal({ open: false, student: null })} className="flex-1 bg-slate-800 text-white py-3 rounded-lg">İptal</button>
                            <button onClick={handleDeposit} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold">Onayla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
