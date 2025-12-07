'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default function SuppliersPage() {
    const supabase = createClient()
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState({
        name: '',
        contact_name: '',
        phone: '',
        address: ''
    })

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

            // 2. Firmaları Çek
            const { data } = await supabase
                .from('suppliers')
                .select('*')
                .eq('school_id', targetSchoolId)
                .order('name', { ascending: true })

            setSuppliers(data || [])

        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchData() }, [searchParams])

    // Form İşlemleri
    const resetForm = () => {
        setForm({ name: '', contact_name: '', phone: '', address: '' })
        setEditingId(null)
        setIsModalOpen(false)
    }

    const handleEdit = (supplier: any) => {
        setEditingId(supplier.id)
        setForm({
            name: supplier.name,
            contact_name: supplier.contact_name || '',
            phone: supplier.phone || '',
            address: supplier.address || ''
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bu firmayı silmek istediğinize emin misiniz?')) return
        const { error } = await supabase.from('suppliers').delete().eq('id', id)
        if (error) alert('Hata: ' + error.message)
        else fetchData()
    }

    const handleSave = async () => {
        const name = form.name?.trim() || ''
        
        if (!name) {
            alert('Lütfen firma adını girin!')
            return
        }

        if (!userSchoolId) {
            alert('Okul bilgisi bulunamadı! Lütfen sayfayı yenileyin.')
            return
        }

        const payload = {
            school_id: userSchoolId,
            name: name.toUpperCase(),
            contact_name: form.contact_name?.trim() || null,
            phone: form.phone?.trim() || null,
            address: form.address?.trim() || null
        }

        let error
        if (editingId) {
            const { error: uError } = await supabase.from('suppliers').update(payload).eq('id', editingId)
            error = uError
        } else {
            const { error: iError } = await supabase.from('suppliers').insert([payload])
            error = iError
        }

        if (error) alert('Hata: ' + error.message)
        else {
            alert(editingId ? 'Firma Güncellendi!' : 'Firma Eklendi!')
            resetForm()
            fetchData()
        }
    }

    // Filtreleme
    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.contact_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Firma Yönetimi (Tedarikçiler)</h1>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true) }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
                >
                    + Yeni Firma Ekle
                </button>
            </div>

            {/* ARAMA */}
            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">🔍</span>
                    <input
                        type="text"
                        placeholder="Firma veya yetkili ara..."
                        className="w-full bg-slate-950 text-white pl-10 p-3 rounded border border-slate-800 focus:border-indigo-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* LİSTE */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSuppliers.map(supplier => (
                    <div key={supplier.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg hover:border-slate-700 transition-all group">
                        <div className="flex justify-between items-start mb-3">
                            <h3 className="text-lg font-bold text-white">{supplier.name}</h3>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(supplier)} className="text-blue-400 hover:text-blue-300">✏️</button>
                                <button onClick={() => handleDelete(supplier.id)} className="text-red-400 hover:text-red-300">🗑️</button>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                                <span>👤</span>
                                <span className="text-slate-300">{supplier.contact_name || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>📞</span>
                                <span className="text-slate-300">{supplier.phone || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span>📍</span>
                                <span className="text-slate-300 truncate">{supplier.address || '-'}</span>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800">
                            <a href={`/canteen/suppliers/${supplier.id}`} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                                📦 Ürünler & Sipariş
                            </a>
                        </div>
                    </div>
                ))}

                {filteredSuppliers.length === 0 && !loading && (
                    <div className="col-span-full text-center py-10 text-slate-500">
                        Kayıtlı firma bulunamadı.
                    </div>
                )}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
                            <h2 className="text-lg font-bold text-white">{editingId ? 'Firmayı Düzenle' : 'Yeni Firma Ekle'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Firma Adı *</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-indigo-500 uppercase"
                                    style={{ textTransform: 'uppercase' }}
                                    placeholder="Örn: ABC GIDA"
                                    value={form.name} 
                                    onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Yetkili Kişi</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-indigo-500 uppercase"
                                    style={{ textTransform: 'uppercase' }}
                                    placeholder="Ad Soyad"
                                    value={form.contact_name} 
                                    onChange={e => setForm({ ...form, contact_name: e.target.value.toUpperCase() })} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Telefon</label>
                                <input type="text" className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-indigo-500"
                                    placeholder="05xx..."
                                    value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Adres</label>
                                <textarea 
                                    className="w-full bg-slate-950 text-white p-3 rounded border border-slate-700 focus:border-indigo-500 h-24 resize-none uppercase"
                                    style={{ textTransform: 'uppercase' }}
                                    placeholder="Adres detayları..."
                                    value={form.address} 
                                    onChange={e => setForm({ ...form, address: e.target.value.toUpperCase() })} 
                                />
                            </div>
                        </div>

                        <div className="p-4 border-t border-slate-800 bg-slate-800/30 flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded font-medium">İptal</button>
                            <button onClick={handleSave} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded font-bold">
                                {editingId ? 'Güncelle' : 'Kaydet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
