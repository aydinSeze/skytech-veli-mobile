'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'

export default function StudentsPage() {
    const supabase = createClientComponentClient()
    const [students, setStudents] = useState<any[]>([])
    const [schools, setSchools] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('') // Arama state'i

    // Para Yükleme Modalı
    const [depositModal, setDepositModal] = useState<{ open: boolean, student: any | null }>({ open: false, student: null })
    const [depositAmount, setDepositAmount] = useState('')

    // Öğrenci Formu
    const [form, setForm] = useState({
        school_id: '',
        full_name: '',
        student_number: '',
        nfc_card_id: '',
        wallet_balance: 0
    })

    const fetchData = async () => {
        try {
            setLoading(true)
            const { data: schoolData } = await supabase.from('schools').select('*')
            setSchools(schoolData || [])

            const { data: studentData } = await supabase
                .from('students')
                .select('*, schools(name)')
                .order('created_at', { ascending: false })
            setStudents(studentData || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    // --- FİLTRELEME MANTIĞI ---
    const filteredStudents = students.filter(student => {
        const search = searchTerm.toLowerCase()
        return (
            student.full_name?.toLowerCase().includes(search) ||
            student.student_number?.toLowerCase().includes(search) ||
            student.nfc_card_id?.toLowerCase().includes(search)
        )
    })

    // KAYDETME (GÜVENLİ)
    const handleSave = async () => {
        if (!form.school_id || !form.full_name || !form.nfc_card_id) {
            alert('Lütfen okul, isim ve Kart ID girin!')
            return
        }

        const safeCardId = form.nfc_card_id.toUpperCase().trim()

        const { data: existing } = await supabase
            .from('students').select('id').eq('nfc_card_id', safeCardId).single()

        if (existing) {
            alert('⛔ HATA: Bu Kart ID (' + safeCardId + ') zaten kayıtlı!')
            return
        }

        const { error } = await supabase.from('students').insert([{
            school_id: form.school_id, full_name: form.full_name, student_number: form.student_number,
            nfc_card_id: safeCardId, wallet_balance: form.wallet_balance
        }])

        if (error) alert('Hata: ' + error.message)
        else {
            alert('Öğrenci Kaydedildi!')
            setForm({ school_id: '', full_name: '', student_number: '', nfc_card_id: '', wallet_balance: 0 })
            fetchData()
        }
    }

    // PARA YÜKLEME
    const handleDeposit = async () => {
        if (!depositModal.student || !depositAmount) return
        const amount = parseFloat(depositAmount)
        if (amount <= 0) return alert('Geçersiz tutar!')

        const newBalance = depositModal.student.wallet_balance + amount

        await supabase.from('students').update({ wallet_balance: newBalance }).eq('id', depositModal.student.id)
        await supabase.from('transactions').insert([{
            student_id: depositModal.student.id, amount: amount, transaction_type: 'deposit', canteen_id: null
        }])

        alert(`✅ ${amount} TL Yüklendi!\nGüncel Bakiye: ₺${newBalance}`)
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
        <div className="p-6 space-y-6">
            <h1 className="text-2xl font-bold text-white">Öğrenci Yönetimi</h1>

            {/* FORM */}
            <div className="bg-slate-800 p-4 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end border border-slate-700">
                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Okul</label>
                    <select className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.school_id} onChange={e => setForm({ ...form, school_id: e.target.value })}>
                        <option value="">Seçiniz...</option>
                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Ad Soyad</label>
                    <input type="text" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700" placeholder="Ad Soyad"
                        value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Okul No</label>
                    <input type="text" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700" placeholder="123"
                        value={form.student_number} onChange={e => setForm({ ...form, student_number: e.target.value })} />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">Kart ID</label>
                    <input type="text" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700 uppercase" placeholder="KART123"
                        value={form.nfc_card_id} onChange={e => setForm({ ...form, nfc_card_id: e.target.value })} />
                </div>
                <div className="lg:col-span-1">
                    <label className="block text-sm text-slate-400 mb-1">İlk Bakiye</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.wallet_balance} onChange={e => setForm({ ...form, wallet_balance: parseFloat(e.target.value) })} />
                </div>
                <div className="lg:col-span-1">
                    <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-10 rounded font-bold">
                        + Kaydet
                    </button>
                </div>
            </div>

            {/* ARAMA ÇUBUĞU */}
            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-slate-400">🔍</span>
                    </div>
                    <input
                        type="text"
                        className="w-full bg-slate-900 text-white pl-10 p-3 rounded border border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        placeholder="Öğrenci Ara (İsim, Okul No, Kart ID)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* LİSTE */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400">
                        <tr>
                            <th className="p-4">Ad Soyad</th>
                            <th className="p-4">Okul / No</th>
                            <th className="p-4">Kart ID</th>
                            <th className="p-4">Bakiye</th>
                            <th className="p-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.map(student => (
                            <tr key={student.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="p-4 font-medium text-white">{student.full_name}</td>
                                <td className="p-4 text-sm text-slate-400">{student.schools?.name} <span className="text-slate-500">#{student.student_number}</span></td>
                                <td className="p-4 font-mono text-xs"><span className="bg-slate-900 px-2 py-1 rounded">{student.nfc_card_id}</span></td>
                                <td className="p-4 text-green-400 font-bold text-lg">₺{student.wallet_balance}</td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={() => setDepositModal({ open: true, student: student })}
                                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm font-bold">
                                        + ₺ Yükle
                                    </button>
                                    <button onClick={() => handleDelete(student.id)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-sm">🗑️</button>
                                </td>
                            </tr>
                        ))}
                        {filteredStudents.length === 0 && (
                            <tr><td colSpan={5} className="p-8 text-center text-slate-500">
                                {searchTerm ? 'Aradığınız kriterde öğrenci bulunamadı.' : 'Henüz kayıtlı öğrenci yok.'}
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* PARA YÜKLEME POPUP */}
            {depositModal.open && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="bg-slate-800 p-6 rounded-xl w-96 border border-slate-600 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Bakiye Yükle</h2>
                        <div className="mb-4">
                            <div className="text-slate-400 text-sm">Öğrenci</div>
                            <div className="text-white font-bold text-lg">{depositModal.student?.full_name}</div>
                            <div className="text-green-400 text-sm">Mevcut: ₺{depositModal.student?.wallet_balance}</div>
                        </div>
                        <input type="number" className="w-full bg-slate-900 text-white text-2xl p-3 rounded border border-green-500 mb-4 text-center"
                            placeholder="0.00" autoFocus value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                        <div className="flex gap-3">
                            <button onClick={() => setDepositModal({ open: false, student: null })} className="flex-1 bg-slate-700 text-white py-3 rounded-lg">İptal</button>
                            <button onClick={handleDeposit} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold">Onayla</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
