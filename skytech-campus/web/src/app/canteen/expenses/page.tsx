'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export const dynamic = 'force-dynamic'

// Türkçe karakterleri İngilizce karşılıklarına çeviren yardımcı fonksiyon (PDF için)
const latinify = (str: string) => {
    if (!str) return ''
    const mapping: { [key: string]: string } = {
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C'
    }
    return str.split('').map(char => mapping[char] || char).join('')
}

export default function ExpensesPage() {
    const supabase = createClient()
    const [expenses, setExpenses] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)
    const [schoolName, setSchoolName] = useState<string>('')
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: 'Diğer'
    })

    const categories = ['Fatura', 'Personel', 'Malzeme', 'Kira', 'Vergi', 'Diğer']

    useEffect(() => {
        const fetchInitialData = async () => {
            const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
            const urlSchoolId = urlParams.get('schoolId')
            
            if (urlSchoolId) {
                // Yönetici modu - URL'den schoolId al
                setUserSchoolId(urlSchoolId)
                const { data: school } = await supabase.from('schools').select('name').eq('id', urlSchoolId).single()
                if (school) setSchoolName(school.name.toUpperCase())
            } else {
                // Normal kullanıcı - Profile'dan al
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
                if (!profile?.school_id) return
                setUserSchoolId(profile.school_id)

                // Okul Adını Çek
                const { data: school } = await supabase.from('schools').select('name').eq('id', profile.school_id).single()
                if (school) setSchoolName(school.name.toUpperCase())
            }
        }
        fetchInitialData()
    }, [])

    useEffect(() => {
        if (!userSchoolId) return
        fetchExpenses()
    }, [userSchoolId])

    const fetchExpenses = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('expenses')
            .select('*')
            .eq('school_id', userSchoolId)
            .order('expense_date', { ascending: false })

        setExpenses(data || [])
        setLoading(false)
    }

    const handleSave = async () => {
        // Trim ile kontrol et
        const description = formData.description?.trim() || ''
        const amount = formData.amount?.trim() || ''

        if (!userSchoolId) {
            alert('Okul bilgisi bulunamadı. Lütfen sayfayı yenileyin.')
            return
        }

        if (!description || !amount) {
            alert('Lütfen Açıklama ve Tutar alanlarını doldurun.')
            return
        }

        const parsedAmount = parseFloat(amount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            alert('Geçerli bir tutar giriniz.')
            return
        }

        const { error } = await supabase.from('expenses').insert([{
            school_id: userSchoolId,
            title: description.toUpperCase(), // Büyük harfe çevir
            amount: parsedAmount,
            expense_date: formData.date,
            category: formData.category
        }])

        if (error) {
            alert('Hata: ' + error.message)
        } else {
            alert('Gider başarıyla eklendi!')
            setIsModalOpen(false)
            setFormData({
                description: '',
                amount: '',
                date: new Date().toISOString().split('T')[0],
                category: 'Diğer'
            })
            fetchExpenses()
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bu gider kaydını silmek istediğinize emin misiniz?')) return

        const { error } = await supabase.from('expenses').delete().eq('id', id)
        if (error) {
            alert('Hata: ' + error.message)
        } else {
            fetchExpenses()
        }
    }

    const handleDownloadPdf = () => {
        const doc = new jsPDF()
        const dateStr = new Date().toLocaleDateString('tr-TR')

        // Başlık
        doc.setFontSize(16)
        doc.text(latinify(`${schoolName} - GIDER RAPORU`), 14, 20)
        doc.setFontSize(10)
        doc.text(`Rapor Tarihi: ${dateStr}`, 14, 28)

        // Tablo Verisi
        const tableData = expenses.map(item => [
            new Date(item.expense_date).toLocaleDateString('tr-TR'),
            latinify(item.title),
            latinify(item.category),
            item.amount.toFixed(2) + ' TL'
        ])

        // Toplam Tutar
        const totalAmount = expenses.reduce((sum, item) => sum + item.amount, 0)
        tableData.push(['', '', 'TOPLAM GIDER', totalAmount.toFixed(2) + ' TL'])

        autoTable(doc, {
            startY: 35,
            head: [['Tarih', 'Aciklama', 'Kategori', 'Tutar']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38] }, // Kırmızı başlık
            styles: { fontSize: 10 },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 40 },
                3: { cellWidth: 40, halign: 'right' }
            }
        })

        doc.save(`Gider_Raporu_${dateStr}.pdf`)
    }

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">💸 Gider Yönetimi</h1>
                    <p className="text-slate-400 text-sm">Kantin giderlerini buradan takip edebilirsiniz.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleDownloadPdf}
                        className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2 shadow-lg hover:shadow-red-900/20 transition-all"
                    >
                        📄 PDF İndir
                    </button>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2 shadow-lg hover:shadow-orange-900/20 transition-all"
                    >
                        ➕ Yeni Gider Ekle
                    </button>
                </div>
            </div>

            {/* TOPLAM GİDER KARTI */}
            {!loading && expenses.length > 0 && (
                <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-xs text-slate-400 uppercase font-bold mb-1">Toplam Gider</div>
                            <div className="text-3xl font-bold text-red-400">
                                ₺{expenses.reduce((sum, item) => sum + (item.amount || 0), 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{expenses.length} gider kaydı</div>
                        </div>
                    </div>
                </div>
            )}

            {/* GİDER TABLOSU */}
            <div className="bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-xs tracking-wider">
                        <tr>
                            <th className="p-4">Tarih</th>
                            <th className="p-4">Açıklama</th>
                            <th className="p-4">Kategori</th>
                            <th className="p-4 text-right">Tutar</th>
                            <th className="p-4 text-center">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={5} className="p-4 text-center">Yükleniyor...</td></tr>
                        ) : expenses.length === 0 ? (
                            <tr><td colSpan={5} className="p-4 text-center text-slate-500">Henüz gider kaydı bulunmuyor.</td></tr>
                        ) : (
                            expenses.map(expense => (
                                <tr key={expense.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4 text-sm font-mono text-slate-400">
                                        {new Date(expense.expense_date).toLocaleDateString('tr-TR')}
                                    </td>
                                    <td className="p-4 font-medium text-white">{expense.title}</td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 rounded text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-bold text-red-400">
                                        - ₺{expense.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleDelete(expense.id)}
                                            className="text-slate-500 hover:text-red-400 transition-colors"
                                            title="Sil"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Yeni Gider Ekle</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Tarih</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-orange-500 outline-none"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1">Açıklama</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-orange-500 outline-none uppercase"
                                    style={{ textTransform: 'uppercase' }}
                                    placeholder="Örn: Toptancı Ödemesi"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value.toUpperCase() })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Tutar (TL)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-orange-500 outline-none"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 mb-1">Kategori</label>
                                    <select
                                        className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-orange-500 outline-none appearance-none"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    >
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-bold transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-500 font-bold transition-colors shadow-lg hover:shadow-orange-900/20"
                            >
                                Kaydet
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
