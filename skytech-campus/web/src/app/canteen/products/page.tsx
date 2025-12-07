'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import { Dices } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function ProductsPage() {
    const supabase = createClient()
    const [products, setProducts] = useState<any[]>([])
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState<string>('')
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)

    const [form, setForm] = useState({
        name: '',
        barcode: '',
        buying_price: 0,
        selling_price: 0,
        stock_quantity: 0,
        supplier_id: '',
        company_phone: ''
    })

    // --- BENZERSİZ BARKOD ÜRETİCİ ---
    const generateUniqueBarcode = useCallback(async () => {
        if (!userSchoolId) {
            console.error('Okul ID bulunamadı, barkod üretilemiyor')
            return ''
        }

        let isUnique = false
        let newCode = ''

        // Basit bir döngü ile benzersizlik kontrolü (Sadece kendi okulunun ürünlerinde)
        while (!isUnique) {
            newCode = Math.floor(10000000 + Math.random() * 90000000).toString()
            const { data } = await supabase
                .from('products')
                .select('id')
                .eq('barcode', newCode)
                .eq('school_id', userSchoolId) // Okul filtresi eklendi
            if (!data || data.length === 0) {
                isUnique = true
            }
        }
        return newCode
    }, [supabase, userSchoolId])

    // Sayfa ilk açıldığında barkod üret (İPTAL EDİLDİ - Kullanıcı boş istiyor)
    /*
    useEffect(() => {
        generateUniqueBarcode().then(code => setForm(prev => ({ ...prev, barcode: code })))
    }, [generateUniqueBarcode])
    */

    // Saat Efekti
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('tr-TR')), 1000)
        return () => clearInterval(timer)
    }, [])

    // Verileri Çek
    const fetchData = async () => {
        try {
            setLoading(true)

            // 1. Kullanıcının Okul ID'sini Çek (Yönetici için URL parametresinden)
            const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
            const urlSchoolId = urlParams.get('schoolId')
            let targetSchoolId: string | null = null

            if (urlSchoolId) {
                // Yönetici modu - URL'den schoolId al
                targetSchoolId = urlSchoolId
                setUserSchoolId(urlSchoolId)
            } else {
                // Normal kullanıcı - Profile'dan al
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
                if (!profile?.school_id) {
                    alert('Okul bilgisi bulunamadı! Lütfen sayfayı yenileyin.')
                    setLoading(false)
                    return
                }
                targetSchoolId = profile.school_id
                setUserSchoolId(profile.school_id)
            }

            if (!targetSchoolId) {
                setLoading(false)
                return
            }

            // 2. Tedarikçileri Çek
            const { data: supplierData } = await supabase.from('suppliers').select('*').eq('school_id', targetSchoolId)
            setSuppliers(supplierData || [])

            // 3. Sadece bu okula ait ürünleri çek (Pagination: 1000 ürün limit)
            const { data: productData } = await supabase
                .from('products')
                .select('id, name, barcode, buying_price, selling_price, stock_quantity, supplier_id, company_phone, created_at, suppliers(name)')
                .eq('school_id', targetSchoolId)
                .order('created_at', { ascending: false })
                .limit(1000) // PERFORMANS: Maksimum 1000 ürün
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
        // const newCode = await generateUniqueBarcode() // ARTIK BOŞ GELİYOR
        setForm({
            name: '',
            barcode: '', // Varsayılan boş
            buying_price: 0,
            selling_price: 0,
            stock_quantity: 0,
            supplier_id: '',
            company_phone: ''
        })
        setEditingId(null)
    }

    // Düzenle Butonu
    const handleEdit = (product: any) => {
        setEditingId(product.id)
        setForm({
            name: product.name,
            barcode: product.barcode || '',
            buying_price: product.buying_price,
            selling_price: product.selling_price,
            stock_quantity: product.stock_quantity,
            supplier_id: product.supplier_id || '',
            company_phone: product.company_phone || ''
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
        const name = form.name?.trim() || ''
        
        if (!name) {
            alert('Lütfen ürün adını girin!')
            return
        }

        if (!userSchoolId) {
            alert('Okul bilgisi bulunamadı! Lütfen sayfayı yenileyin.')
            return
        }

        const payload = {
            school_id: userSchoolId,
            canteen_id: null, // ARTIK ZORUNLU DEĞİL
            name: name.toUpperCase(),
            barcode: form.barcode?.trim() || null,
            buying_price: form.buying_price || 0,
            selling_price: form.selling_price || 0,
            stock_quantity: form.stock_quantity || 0,
            supplier_id: form.supplier_id || null,
            company_phone: form.company_phone?.trim() || null
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
                    <label className="block text-sm text-slate-400 mb-1">Ürün Adı</label>
                    <input 
                        type="text" 
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700 uppercase" 
                        placeholder="Örn: TOST"
                        style={{ textTransform: 'uppercase' }}
                        value={form.name} 
                        onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} 
                    />
                </div>

                {/* AKILLI BARKOD ALANI */}
                <div className="relative">
                    <label className="block text-sm text-slate-400 mb-1">Barkod (Boş bırakılabilir)</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="w-full bg-slate-900 text-green-400 font-mono font-bold p-2 rounded border border-slate-700 focus:border-indigo-500 outline-none"
                            placeholder="Okutunuz veya boş bırakınız"
                            value={form.barcode}
                            onChange={e => setForm({ ...form, barcode: e.target.value })}
                        />
                        <button
                            onClick={async () => {
                                const code = await generateUniqueBarcode()
                                setForm({ ...form, barcode: code })
                            }}
                            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 rounded transition-colors flex items-center justify-center"
                            title="Barkodsuz ürün için rastgele oluştur"
                        >
                            <Dices size={20} />
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm text-slate-400 mb-1">Alış Fiyatı</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={isNaN(form.buying_price) ? '' : form.buying_price} 
                        onChange={e => {
                            const val = parseFloat(e.target.value);
                            setForm({ ...form, buying_price: isNaN(val) ? 0 : val });
                        }} />
                </div>
                <div>
                    <label className="block text-sm text-slate-400 mb-1">Satış Fiyatı</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={isNaN(form.selling_price) ? '' : form.selling_price} 
                        onChange={e => {
                            const val = parseFloat(e.target.value);
                            setForm({ ...form, selling_price: isNaN(val) ? 0 : val });
                        }} />
                </div>
                <div>
                    <label className="block text-sm text-slate-400 mb-1">Stok Adedi</label>
                    <input type="number" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={isNaN(form.stock_quantity) ? '' : form.stock_quantity} 
                        onChange={e => {
                            const val = parseInt(e.target.value);
                            setForm({ ...form, stock_quantity: isNaN(val) ? 0 : val });
                        }} />
                </div>

                {/* TEDARİKÇİ SEÇİMİ */}
                <div>
                    <label className="block text-sm text-slate-400 mb-1">🏢 Tedarikçi (Firma)</label>
                    <select
                        className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        value={form.supplier_id}
                        onChange={e => setForm({ ...form, supplier_id: e.target.value })}
                    >
                        <option value="">Seçiniz...</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-slate-400 mb-1">📞 Firma Telefon (Opsiyonel)</label>
                    <input type="text" className="w-full bg-slate-900 text-white p-2 rounded border border-slate-700"
                        placeholder="05xx xxx xx xx"
                        value={form.company_phone} onChange={e => setForm({ ...form, company_phone: e.target.value })} />
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
                            <th className="p-4">Tedarikçi</th>
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
                                </td>
                                <td className="p-4 font-mono text-sm text-green-400">{product.barcode}</td>
                                <td className="p-4 text-sm text-blue-300">{product.suppliers?.name || '-'}</td>
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
