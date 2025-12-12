'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Calendar, Plus, Edit2, Trash2, X, Bell, Check } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function EtutMenuPage() {
    const supabase = createClient()
    const [menus, setMenus] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    // YENİ: buying_price ve profit eklendi, price artık satış fiyatı
    const [menuItems, setMenuItems] = useState<{ name: string, buying_price: number, profit: number, price: number }[]>([{ name: '', buying_price: 0, profit: 0, price: 0 }])

    useEffect(() => {
        const fetchData = async () => {
            // URL parametrelerini client-side'da oku (server-safe)
            if (typeof window === 'undefined') return

            const urlParams = new URLSearchParams(window.location.search)
            const urlSchoolId = urlParams.get('schoolId')

            if (urlSchoolId) {
                setUserSchoolId(urlSchoolId)
            } else {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return
                const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
                if (!profile?.school_id) return
                setUserSchoolId(profile.school_id)
            }
        }
        fetchData()
    }, [])

    useEffect(() => {
        if (userSchoolId) {
            fetchMenus()
        }
    }, [userSchoolId])

    const fetchMenus = async () => {
        if (!userSchoolId) return
        setLoading(true)
        try {
            const { data } = await supabase
                .from('etut_menu')
                .select('*')
                .eq('school_id', userSchoolId)
                .order('menu_date', { ascending: false })
                .limit(30)
            setMenus(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!userSchoolId) {
            alert('Okul bilgisi bulunamadı!')
            return
        }

        const validItems = menuItems.filter(item => item.name.trim() && item.price > 0)
        if (validItems.length === 0) {
            alert('En az bir yemek ekleyin ve satış fiyatını girin!')
            return
        }

        try {
            const data = {
                school_id: userSchoolId,
                menu_date: selectedDate,
                items_json: validItems, // JSON olarak kaydedilecek (yeni alanlarla)
                is_active: true,
                notification_sent: false
            }

            if (editingId) {
                const { error } = await supabase.from('etut_menu').update(data).eq('id', editingId)
                if (error) throw error
            } else {
                const { error } = await supabase.from('etut_menu').insert([data])
                if (error) throw error
            }

            setIsModalOpen(false)
            setEditingId(null)
            setMenuItems([{ name: '', buying_price: 0, profit: 0, price: 0 }])
            setSelectedDate(new Date().toISOString().split('T')[0])
            await fetchMenus()
            alert('✅ Menü başarıyla kaydedildi!')
        } catch (error: any) {
            console.error('Kaydetme hatası:', error)
            alert(`Hata: ${error.message || 'Bilinmeyen hata'}`)
        }
    }

    const handleEdit = (menu: any) => {
        setEditingId(menu.id)
        setSelectedDate(menu.menu_date)
        // Eğer eski veri varsa uyum sağla
        const items = menu.items_json?.map((item: any) => ({
            name: item.name,
            buying_price: item.buying_price || 0,
            profit: item.profit || 0,
            price: item.price || 0
        })) || [{ name: '', buying_price: 0, profit: 0, price: 0 }]

        setMenuItems(items)
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Bu menüyü silmek istediğinize emin misiniz?')) return
        const { error } = await supabase.from('etut_menu').delete().eq('id', id)
        if (error) throw error
        fetchMenus()
    }

    const sendNotification = async (menu: any) => {
        if (!confirm('Velilere bildirim göndermek istediğinize emin misiniz?')) return
        await supabase.from('etut_menu').update({ notification_sent: true }).eq('id', menu.id)
        alert('✅ Bildirim gönderildi! (Mobil entegrasyon sonrası aktif olacak)')
        fetchMenus()
    }

    // Kar Hesaplama Yardımcısı
    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...menuItems]
        const item = { ...newItems[index], [field]: value }

        // Otomatik Kar Hesabı: Kar = Satış - Alış
        if (field === 'buying_price' || field === 'price') {
            const buy = field === 'buying_price' ? parseFloat(value) || 0 : item.buying_price
            const sell = field === 'price' ? parseFloat(value) || 0 : item.price
            item.profit = parseFloat((sell - buy).toFixed(2))
        }

        newItems[index] = item
        setMenuItems(newItems)
    }

    if (loading) return <div className="p-10 text-white text-center">Yükleniyor...</div>

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Calendar size={28} className="text-orange-400" />
                        Etüt Günleri Menüsü
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Etüt günleri için yemek menüsü oluşturun ve velilere bildirim gönderin</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null)
                        setSelectedDate(new Date().toISOString().split('T')[0])
                        setMenuItems([{ name: '', buying_price: 0, profit: 0, price: 0 }])
                        setIsModalOpen(true)
                    }}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"
                >
                    <Plus size={20} /> Yeni Menü
                </button>
            </div>

            {/* MENÜ LİSTESİ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {menus.map(menu => (
                    <div key={menu.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <div className="text-lg font-bold text-white">
                                    {new Date(menu.menu_date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                </div>
                                <div className="text-xs text-slate-400">
                                    {new Date(menu.menu_date).toLocaleDateString('tr-TR')}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {!menu.notification_sent && (
                                    <button
                                        onClick={() => sendNotification(menu)}
                                        className="bg-green-600 hover:bg-green-500 text-white p-2 rounded text-xs"
                                        title="Bildirim Gönder"
                                    >
                                        <Bell size={14} />
                                    </button>
                                )}
                                {menu.notification_sent && (
                                    <div className="bg-green-500/20 text-green-400 p-2 rounded text-xs" title="Bildirim Gönderildi">
                                        <Check size={14} />
                                    </div>
                                )}
                                <button onClick={() => handleEdit(menu)} className="text-blue-400 hover:text-blue-300"><Edit2 size={16} /></button>
                                <button onClick={() => handleDelete(menu.id)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {menu.items_json && Array.isArray(menu.items_json) && menu.items_json.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm bg-slate-800/50 p-2 rounded items-center">
                                    <span className="text-slate-300">{item.name}</span>
                                    <div className="text-right">
                                        <div className="text-green-400 font-bold">₺{item.price}</div>
                                        {/* Sadece display amaçlı kar gösterelim */}
                                        {item.profit > 0 && <div className="text-[10px] text-slate-500">Kar: ₺{item.profit}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 p-6 rounded-xl w-full max-w-4xl border border-slate-800 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">{editingId ? 'Menü Düzenle' : 'Yeni Menü'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Tarih</label>
                                <input
                                    type="date"
                                    className="w-full bg-slate-800 border border-slate-700 text-white p-3 rounded-lg"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Yemekler</label>

                                {/* Başlıklar */}
                                <div className="flex gap-2 text-xs text-slate-500 mb-1 px-1">
                                    <div className="flex-1">Yemek Adı</div>
                                    <div className="w-24">Geliş (₺)</div>
                                    <div className="w-24">Kar (₺)</div>
                                    <div className="w-24">Satış (₺)</div>
                                    <div className="w-8"></div>
                                </div>

                                {menuItems.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            placeholder="Örn: Tavuk Sote"
                                            className="flex-1 bg-slate-800 border border-slate-700 text-white p-2 rounded-lg"
                                            value={item.name}
                                            onChange={(e) => updateItem(idx, 'name', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Geliş"
                                            className="w-24 bg-slate-800 border border-slate-700 text-white p-2 rounded-lg"
                                            value={item.buying_price || ''}
                                            onChange={(e) => updateItem(idx, 'buying_price', e.target.value)}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Kar"
                                            readOnly // Kar otomatik hesaplanıyor
                                            className="w-24 bg-slate-900 border border-slate-800 text-green-500 font-bold p-2 rounded-lg cursor-not-allowed"
                                            value={item.profit || 0}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            placeholder="Satış"
                                            className="w-24 bg-slate-800 border border-slate-700 text-white p-2 rounded-lg font-bold"
                                            value={item.price || ''}
                                            onChange={(e) => updateItem(idx, 'price', e.target.value)}
                                        />
                                        {menuItems.length > 1 && (
                                            <button
                                                onClick={() => setMenuItems(menuItems.filter((_, i) => i !== idx))}
                                                className="bg-red-600 hover:bg-red-500 text-white px-2 rounded w-8"
                                            >
                                                <X size={16} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    onClick={() => setMenuItems([...menuItems, { name: '', buying_price: 0, profit: 0, price: 0 }])}
                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold mt-2"
                                >
                                    + Yemek Ekle
                                </button>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg font-bold"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-lg font-bold"
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
