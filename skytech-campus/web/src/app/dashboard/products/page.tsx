'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState, useCallback } from 'react'

export default function ProductsPage() {
    const supabase = createClientComponentClient()
    const [products, setProducts] = useState<any[]>([])
    const [canteens, setCanteens] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState<string>('')

    const [form, setForm] = useState({
        canteen_id: '',
        name: '',
        barcode: '',
        buying_price: 0,
        selling_price: 0,
        stock_quantity: 0
    })

    // --- BENZERSİZ BARKOD ÜRETİCİ ---
    const generateUniqueBarcode = useCallback(async () => {
        let isUnique = false
        let newCode = ''

        // Basit bir döngü ile benzersizlik kontrolü
        while (!isUnique) {
            newCode = Math.floor(10000000 + Math.random() * 90000000).toString()
            const { data } = await supabase.from('products').select('id').eq('barcode', newCode)
            if (!data || data.length === 0) {
                isUnique = true
            }
        }
        return newCode
    }, [supabase])

    // Sayfa ilk açıldığında barkod üret
    useEffect(() => {
        generateUniqueBarcode().then(code => setForm(prev => ({ ...prev, barcode: code })))
    }, [generateUniqueBarcode])

    // Saat Efekti
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('tr-TR')), 1000)
        return () => clearInterval(timer)
    }, [])

    // Verileri Çek
    const fetchData = async () => {
        try {
            setLoading(true)
            const { data: canteenData } = await supabase.from('canteens').select('*')
            setCanteens(canteenData || [])

            const { data: productData } = await supabase
                .from('products').select('*, canteens(name)').order('created_at', { ascending: false })
            setProducts(productData || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [])

    // Formu Sıfırla (Yeni Barkodla)
    const resetForm = async () => {
        const newCode = await generateUniqueBarcode()
        setForm({ canteen_id: '', name: '', barcode: newCode, buying_price: 0, selling_price: 0, stock_quantity: 0 })
        setEditingId(null)
    }

    // Düzenle Butonu
    const handleEdit = (product: any) => {
        setEditingId(product.id)
        setForm({
            canteen_id: product.canteen_id,
            name: product.name,
            barcode: product.barcode || '',
            buying_price: product.buying_price,
            selling_price: product.selling_price,
            stock_quantity: product.stock_quantity
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Sil Butonu
    const handleDelete = async (id: string) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return
        const { error } = await supabase.from('products').delete().eq('id', id)
        if (!error) fetchData()
    }

    // Kaydet / Güncelle
    const handleSave = async () => {
        if (!form.canteen_id || !form.name) return alert('Lütfen kantin ve ürün adını girin!')

        const payload = {
            canteen_id: form.canteen_id,
            name: form.name,
            barcode: form.barcode,
            buying_price: form.buying_price,
            selling_price: form.selling_price,
            stock_quantity: form.stock_quantity
        }

        let error
        if (editingId) {
            const { error: uError } = await supabase.from('products').update(payload).eq('id', editingId)
            error = uError
        } else {
            const { error: iError } = await supabase.from('products').insert([payload])
            error = iError
        }

        if (error) alert('Hata: ' + error.message)
        else {
            alert(editingId ? 'Ürün Güncellendi!' : 'Ürün Eklendi!')
            await resetForm()
            fetchData()
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Ürün Yönetimi</h1>
                <div className="text-slate-400 font-mono bg-slate-800 px-3 py-1 rounded border border-slate-700">
                    🕒 {currentTime}
                </div>
            </div>

            {/* FORM ALANI */}
            <div className={`p-4 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4 items-end border transition-all
        ${editingId ? 'bg-yellow-900/20 border-yellow-600' : 'bg-slate-800 border-slate-800'}`}>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Kantin Seçimi</label>
                    <select className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.canteen_id} onChange={e => setForm({ ...form, canteen_id: e.target.value })}>
                        <option value="">Seçiniz...</option>
                        {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Ürün Adı</label>
                    <input type="text" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700" placeholder="Örn: Tost"
                        value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>

                {/* AKILLI BARKOD ALANI */}
                <div className="relative">
                    <label className="block text-sm text-slate-400 mb-1">Barkod (Otomatik)</label>
                    <div className="flex gap-2">
                        <input type="text" className="w-full bg-slate-900 text-green-400 font-mono font-bold p-2 rounded border border-slate-700"
                            value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                        <button
                            onClick={async () => {
                                const code = await generateUniqueBarcode()
                                setForm({ ...form, barcode: code })
                            }}
                            className="bg-slate-700 text-white px-3 rounded hover:bg-slate-600"
                            title="Yeni Barkod Üret"
                        >
                            🎲
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Alış Fiyatı</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.buying_price} onChange={e => setForm({ ...form, buying_price: parseFloat(e.target.value) })} />
                </div>
                <div>
                    <label className="block text-sm text-slate-400 mb-1">Satış Fiyatı</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.selling_price} onChange={e => setForm({ ...form, selling_price: parseFloat(e.target.value) })} />
                </div>
                <div>
                    <label className="block text-sm text-slate-400 mb-1">Stok Adedi</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: parseInt(e.target.value) })} />
                </div>

                <div className="flex gap-2 md:col-span-3 lg:col-span-1">
                    {editingId && (
                        <button onClick={resetForm} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded font-semibold h-10">
                            İptal
                        </button>
                    )}
                    <button onClick={handleSave}
                        className={`flex-[2] text-white px-6 py-2 rounded font-semibold h-10 transition-colors w-full
            ${editingId ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                        {editingId ? '🔄 Güncelle' : '💾 Kaydet'}
                    </button>
                </div>
            </div>

            {/* LİSTE */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-slate-300">
                    <thead className="bg-slate-900 text-slate-400">
                        <tr>
                            <th className="p-4">Ürün Adı</th>
                            <th className="p-4">Barkod</th>
                            <th className="p-4">Fiyat</th>
                            <th className="p-4">Stok</th>
                            <th className="p-4 text-right">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => (
                            <tr key={product.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="p-4 font-medium">
                                    {product.name}
                                    <div className="text-xs text-slate-500">{product.canteens?.name}</div>
                                </td>
                                <td className="p-4 font-mono text-sm text-green-400">{product.barcode}</td>
                                <td className="p-4 font-bold">₺{product.selling_price}</td>
                                <td className={`p-4 font-bold ${product.stock_quantity < 10 ? 'text-red-500' : 'text-white'}`}>
                                    {product.stock_quantity}
                                    {product.stock_quantity < 10 && <span className="ml-2 text-xs bg-red-900/50 px-1 rounded">KRİTİK</span>}
                                </td>
                                <td className="p-4 text-right space-x-2">
                                    <button onClick={() => handleEdit(product)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-3 py-1 rounded text-sm">✏️</button>
                                    <button onClick={() => handleDelete(product.id)} className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-sm">🗑️</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
