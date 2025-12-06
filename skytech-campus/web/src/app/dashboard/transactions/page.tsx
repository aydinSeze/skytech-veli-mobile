'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState } from 'react'

export default function TransactionsPage() {
    const supabase = createClientComponentClient()
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'purchase' | 'load'>('all')

    const fetchTransactions = async () => {
        try {
            setLoading(true)
            let query = supabase
                .from('transactions')
                .select('*, students(full_name), canteens(name)')
                .order('created_at', { ascending: false })

            if (filter !== 'all') {
                query = query.eq('transaction_type', filter)
            }

            const { data, error } = await query

            if (error) console.error('Hata:', error)
            else setTransactions(data || [])

        } catch (error) {
            console.error('Beklenmedik hata:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTransactions()
    }, [filter])

    // Ürün detaylarını parse etme fonksiyonu
    const parseDetails = (json: any) => {
        if (!json) return '-'
        if (Array.isArray(json)) {
            return json.map((item: any) => `${item.name} (${item.quantity})`).join(', ')
        }
        return JSON.stringify(json)
    }

    // Tarih formatlama
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        })
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">İşlem Geçmişi</h1>

                {/* FİLTRE BUTONLARI */}
                <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Tümü
                    </button>
                    <button
                        onClick={() => setFilter('purchase')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'purchase' ? 'bg-red-900/50 text-red-200 shadow' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Satışlar
                    </button>
                    <button
                        onClick={() => setFilter('load')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'load' ? 'bg-green-900/50 text-green-200 shadow' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        Yüklemeler
                    </button>
                </div>
            </div>

            {/* TABLO */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4 font-medium">Tarih</th>
                            <th className="px-6 py-4 font-medium">Öğrenci</th>
                            <th className="px-6 py-4 font-medium">Kantin</th>
                            <th className="px-6 py-4 font-medium">İşlem Tipi</th>
                            <th className="px-6 py-4 font-medium">Detay</th>
                            <th className="px-6 py-4 font-medium text-right">Tutar</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-500">Yükleniyor...</td></tr>
                        ) : transactions.length === 0 ? (
                            <tr><td colSpan={6} className="p-8 text-center text-slate-500">Kayıt bulunamadı.</td></tr>
                        ) : (
                            transactions.map(t => (
                                <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">{formatDate(t.created_at)}</td>
                                    <td className="px-6 py-4 text-white font-medium">{t.students?.full_name || 'Bilinmiyor'}</td>
                                    <td className="px-6 py-4 text-slate-400">{t.canteens?.name || '-'}</td>
                                    <td className="px-6 py-4">
                                        {t.transaction_type === 'purchase' ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400">
                                                🛒 Satış
                                            </span>
                                        ) : t.transaction_type === 'load' ? (
                                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-400">
                                                💰 Yükleme
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">{t.transaction_type}</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 text-xs max-w-xs truncate" title={parseDetails(t.items_json)}>
                                        {parseDetails(t.items_json)}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${t.transaction_type === 'purchase' ? 'text-red-400' : 'text-green-400'
                                        }`}>
                                        {t.transaction_type === 'purchase' ? '-' : '+'}₺{t.amount}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
