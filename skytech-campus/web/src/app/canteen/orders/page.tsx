'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Truck, Package, ArrowRight, Smartphone, CheckCircle, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function OrdersPage() {
    const supabase = createClient()
    const router = useRouter()
    const [suppliers, setSuppliers] = useState<any[]>([])
    const [mobileOrders, setMobileOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'suppliers' | 'mobile'>('mobile')

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
                if (!user) {
                    router.push('/login')
                    return
                }

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

            // 2. Firmaları ve Mobil Siparişleri Çek
            const [suppliersRes, ordersRes] = await Promise.all([
                supabase.from('suppliers')
                    .select('*')
                    .eq('school_id', targetSchoolId)
                    .order('name', { ascending: true }),
                supabase.from('orders')
                    .select('*, students(full_name)')
                    .eq('school_id', targetSchoolId)
                    .eq('order_type', 'mobile')
                    .order('created_at', { ascending: false })
                    .limit(50)
            ])

            setSuppliers(suppliersRes.data || [])
            setMobileOrders(ordersRes.data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [router, supabase, searchParams])

    if (loading) return <div className="p-10 text-white text-center">Yükleniyor...</div>

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Package size={28} className="text-orange-400" />
                        Siparişler
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Mobil siparişleri yönetin ve tedarikçilere sipariş oluşturun</p>
                </div>
            </div>

            {/* SEKMELER */}
            <div className="flex gap-4 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('mobile')}
                    className={`pb-3 px-4 font-medium transition-colors relative ${activeTab === 'mobile' ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Smartphone size={18} />
                        Mobil Siparişler ({mobileOrders.length})
                    </div>
                    {activeTab === 'mobile' && <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500 rounded-t-full"></div>}
                </button>
                <button
                    onClick={() => setActiveTab('suppliers')}
                    className={`pb-3 px-4 font-medium transition-colors relative ${activeTab === 'suppliers' ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <div className="flex items-center gap-2">
                        <Truck size={18} />
                        Tedarikçi Siparişleri
                    </div>
                    {activeTab === 'suppliers' && <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500 rounded-t-full"></div>}
                </button>
            </div>

            {/* MOBİL SİPARİŞLER */}
            {activeTab === 'mobile' && (
                <div className="space-y-4">
                    {mobileOrders.map(order => (
                        <div key={order.id} className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Smartphone size={18} className="text-orange-400" />
                                        <span className="font-bold text-white">
                                            {order.students?.full_name || 'Öğrenci'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {new Date(order.created_at).toLocaleString('tr-TR')}
                                    </div>
                                </div>
                                <div className={`px-3 py-1 rounded text-xs font-bold ${
                                    order.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                    order.status === 'preparing' ? 'bg-yellow-500/20 text-yellow-400' :
                                    order.status === 'ready' ? 'bg-blue-500/20 text-blue-400' :
                                    order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                    'bg-slate-500/20 text-slate-400'
                                }`}>
                                    {order.status === 'pending' ? 'Bekliyor' :
                                     order.status === 'preparing' ? 'Hazırlanıyor' :
                                     order.status === 'ready' ? 'Hazır' :
                                     order.status === 'completed' ? 'Tamamlandı' :
                                     'İptal'}
                                </div>
                            </div>
                            <div className="space-y-2 mb-3">
                                {order.items_json && Array.isArray(order.items_json) && order.items_json.map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="text-slate-300">{item.name} x{item.quantity}</span>
                                        <span className="text-green-400 font-bold">₺{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
                                <span className="text-lg font-bold text-white">Toplam: ₺{order.total_amount}</span>
                                <div className="flex gap-2">
                                    {order.status === 'pending' && (
                                        <button
                                            onClick={async () => {
                                                await supabase.from('orders').update({ status: 'preparing' }).eq('id', order.id)
                                                fetchData()
                                            }}
                                            className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded text-xs font-bold"
                                        >
                                            Hazırlanıyor
                                        </button>
                                    )}
                                    {order.status === 'preparing' && (
                                        <button
                                            onClick={async () => {
                                                await supabase.from('orders').update({ status: 'ready' }).eq('id', order.id)
                                                fetchData()
                                            }}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold"
                                        >
                                            Hazır
                                        </button>
                                    )}
                                    {order.status === 'ready' && (
                                        <button
                                            onClick={async () => {
                                                await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', order.id)
                                                fetchData()
                                            }}
                                            className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-xs font-bold"
                                        >
                                            Tamamla
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {mobileOrders.length === 0 && (
                        <div className="text-center py-20">
                            <Smartphone size={64} className="mx-auto text-slate-600 mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Henüz mobil sipariş yok</h3>
                            <p className="text-slate-400">Öğrenciler mobil uygulamadan sipariş verdiğinde burada görünecek.</p>
                        </div>
                    )}
                </div>
            )}

            {/* TEDARİKÇİ LİSTESİ */}
            {activeTab === 'suppliers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map(supplier => (
                    <Link 
                        key={supplier.id} 
                        href={`/canteen/suppliers/${supplier.id}${userSchoolId ? `?schoolId=${userSchoolId}` : ''}`}
                        className="bg-slate-900 border border-slate-800 p-6 rounded-lg hover:border-orange-500/50 transition-all group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-orange-500/10 rounded-lg">
                                    <Truck size={24} className="text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
                                        {supplier.name}
                                    </h3>
                                    {supplier.contact_name && (
                                        <p className="text-sm text-slate-400">{supplier.contact_name}</p>
                                    )}
                                </div>
                            </div>
                            <ArrowRight size={20} className="text-slate-600 group-hover:text-orange-400 transition-colors" />
                        </div>

                        <div className="space-y-2 text-sm text-slate-400">
                            {supplier.phone && (
                                <div className="flex items-center gap-2">
                                    <span>📞</span>
                                    <span className="text-slate-300">{supplier.phone}</span>
                                </div>
                            )}
                            {supplier.address && (
                                <div className="flex items-center gap-2">
                                    <span>📍</span>
                                    <span className="text-slate-300 truncate">{supplier.address}</span>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <div className="text-xs text-slate-500 group-hover:text-orange-400 transition-colors">
                                Sipariş oluşturmak için tıklayın →
                            </div>
                        </div>
                    </Link>
                ))}
                {suppliers.length === 0 && !loading && (
                    <div className="text-center py-20">
                        <Package size={64} className="mx-auto text-slate-600 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Henüz tedarikçi yok</h3>
                        <p className="text-slate-400 mb-6">Sipariş oluşturmak için önce bir tedarikçi eklemeniz gerekiyor.</p>
                    <Link 
                        href={`/canteen/suppliers${userSchoolId ? `?schoolId=${userSchoolId}` : ''}`}
                        className="inline-block bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                    >
                        Tedarikçi Ekle →
                    </Link>
                    </div>
                )}
            </div>
            )}
        </div>
    )
}

