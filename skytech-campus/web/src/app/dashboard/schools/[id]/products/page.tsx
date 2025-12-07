'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Package, Plus, Edit2, Trash2, X } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function SchoolProductsPage() {
    const params = useParams()
    const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    const schoolId = params?.id as string || urlParams.get('schoolId')
    const supabase = createClient()
    
    const [products, setProducts] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: '',
        barcode: '',
        buying_price: 0,
        selling_price: 0,
        stock_quantity: 0,
        supplier_id: ''
    })

    useEffect(() => {
        if (schoolId) fetchData()
    }, [schoolId])

    const fetchData = async () => {
        if (!schoolId) return
        setLoading(true)
        try {
            const [prodRes, suppRes] = await Promise.all([
                supabase.from('products').select('*, suppliers(name)').eq('school_id', schoolId).order('created_at', { ascending: false }),
                supabase.from('suppliers').select('*').eq('school_id', schoolId).order('name', { ascending: true })
            ])
            setProducts(prodRes.data || [])
            setSuppliers(suppRes.data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!schoolId) {
            alert('Okul bilgisi bulunamadı!')
            return
        }

        if (!form.name || !form.selling_price) {
            alert('Ürün adı ve satış fiyatı zorunludur!')
            return
        }

        const data = {
            ...form,
            school_id: schoolId,
            buying_price: form.buying_price || 0,
            stock_quantity: form.stock_quantity || 0,
            supplier_id: form.supplier_id || null
        }

        if (editingId) {
            const { error } = await supabase.from('products').update(data).eq('id', editingId)
            if (error) throw error
        } else {
            const { error } = await supabase.from('products').insert([data])
            if (error) throw error
        }

        setIsModalOpen(false)
        setEditingId(null)
        setForm({ name: '', barcode: '', buying_price: 0, selling_price: 0, stock_quantity: 0, supplier_id: '' })
        fetchData()
    }

    const handleEdit = (product: any) => {
        setForm({
            name: product.name,
            barcode: product.barcode || '',
            buying_price: product.buying_price || 0,
            selling_price: product.selling_price || 0,
            stock_quantity: product.stock_quantity || 0,
            supplier_id: product.supplier_id || ''
        })
        setEditingId(product.id)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (error) throw error
        fetchData()
    }

    if (loading) return <div className="p-10 text-center text-slate-500">Yükleniyor...</div>

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Ürünler</h2>
                <button
                    onClick={() => { setEditingId(null); setForm({ name: '', barcode: '', buying_price: 0, selling_price: 0, stock_quantity: 0, supplier_id: '' }); setIsModalOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                    <Plus size={20} /> Yeni Ürün
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-800/50">
                        <tr>
                            <th className="px-4 py-3">Ürün Adı</th>
                            <th className="px-4 py-3">Barkod</th>
                            <th className="px-4 py-3">Tedarikçi</th>
                            <th className="px-4 py-3">Alış</th>
                            <th className="px-4 py-3">Satış</th>
                            <th className="px-4 py-3">Stok</th>
                            <th className="px-4 py-3">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-slate-800/30">
                                <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{p.barcode || '-'}</td>
                                <td className="px-4 py-3 text-slate-400">{p.suppliers?.name || '-'}</td>
                                <td className="px-4 py-3 text-slate-400">₺{p.buying_price}</td>
                                <td className="px-4 py-3 text-green-400 font-bold">₺{p.selling_price}</td>
                                <td className={`px-4 py-3 font-bold ${p.stock_quantity < 10 ? 'text-red-400' : 'text-slate-300'}`}>{p.stock_quantity}</td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(p)} className="text-blue-400 hover:text-blue-300"><Edit2 size={16} /></button>
                                        <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md border border-slate-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">{editingId ? 'Ürün Düzenle' : 'Yeni Ürün'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Ürün Adı *</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Barkod</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg"
                                    value={form.barcode}
                                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Alış Fiyatı</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg"
                                        value={form.buying_price}
                                        onChange={(e) => setForm({ ...form, buying_price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-400 mb-1">Satış Fiyatı *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg"
                                        value={form.selling_price}
                                        onChange={(e) => setForm({ ...form, selling_price: parseFloat(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Stok Adedi</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg"
                                    value={form.stock_quantity}
                                    onChange={(e) => setForm({ ...form, stock_quantity: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Tedarikçi</label>
                                <select
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg"
                                    value={form.supplier_id}
                                    onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleSave}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold"
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
