'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    LayoutDashboard, School, Settings, ShoppingCart,
    Package, Users, History, LogOut, Coffee, Bell, Check, X
} from 'lucide-react'
import { getPendingNotifications, approvePayment, rejectPayment } from '@/actions/payment-actions'
import { toast } from 'sonner' // Opsiyonel, yoksa alert kullanırız

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
    const [userRole, setUserRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [schoolName, setSchoolName] = useState<string>('')
    const [currentDateTime, setCurrentDateTime] = useState<string>('')

    // Bildirim State'leri
    const [notifications, setNotifications] = useState<any[]>([])
    const [isNotificationOpen, setIsNotificationOpen] = useState(false)

    // Bildirimleri Çek
    const fetchNotifications = async () => {
        const data = await getPendingNotifications()
        setNotifications(data)
    }

    // Onaylama
    const handleApprove = async (id: string) => {
        const res = await approvePayment(id)
        if (res.success) {
            // alert(res.message)
            fetchNotifications()
        } else {
            alert('Hata: ' + res.error)
        }
    }

    // Reddetme
    const handleReject = async (id: string) => {
        if (!confirm('Bu ödemeyi reddetmek istediğinize emin misiniz?')) return
        const res = await rejectPayment(id)
        if (res.success) {
            fetchNotifications()
        } else {
            alert('Hata: ' + res.error)
        }
    }

    // --- OTOMATİK ÇIKIŞ AYARLARI ---
    const TIMEOUT_DURATION = 30 * 60 * 1000; // 30 Dakika (Artırıldı)

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }, [router, supabase.auth])

    // Rol Kontrolü ve Realtime - Optimize edilmiş ve hızlandırılmış
    useEffect(() => {
        const checkRole = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    setLoading(false)
                    return
                }

                // Admin için hızlı fallback kontrolü (email bazlı)
                const isAdminEmail = user.email === 'admin@skytech.com' || user.email?.includes('admin')
                if (isAdminEmail) {
                    setUserRole('admin')
                    setSchoolName('SKYTECH YÖNETİM')
                    setLoading(false)
                    
                    // Bildirimleri çek
                    fetchNotifications()

                    // REALTIME ABONELİK
                    const channel = supabase
                        .channel('payment-notifications')
                        .on(
                            'postgres_changes',
                            {
                                event: '*',
                                schema: 'public',
                                table: 'payment_notifications'
                            },
                            (payload) => {
                                console.log('🔔 Realtime Bildirim:', payload)
                                fetchNotifications()
                            }
                        )
                        .subscribe()

                    return () => {
                        supabase.removeChannel(channel)
                    }
                }

                // Profil kontrolü (admin değilse veya email kontrolü yeterli değilse)
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role, school_id')
                    .eq('id', user.id)
                    .single()

                let role = profile?.role

                // FALLBACK: Profil yoksa veya rol gelmediyse ama email admin ise
                if (!role && isAdminEmail) {
                    role = 'admin'
                }

                setUserRole(role || 'student')

                // Admin ise okul adını ayarla
                if (role === 'admin' || role === 'school_admin') {
                    setSchoolName('SKYTECH YÖNETİM')
                    fetchNotifications()

                    // REALTIME ABONELİK
                    const channel = supabase
                        .channel('payment-notifications')
                        .on(
                            'postgres_changes',
                            {
                                event: '*',
                                schema: 'public',
                                table: 'payment_notifications'
                            },
                            (payload) => {
                                console.log('🔔 Realtime Bildirim:', payload)
                                fetchNotifications()
                            }
                        )
                        .subscribe()

                    return () => {
                        supabase.removeChannel(channel)
                    }
                } else if (profile?.school_id) {
                    // Kantinci ise okul adını çek
                    const { data: school } = await supabase
                        .from('schools')
                        .select('name')
                        .eq('id', profile.school_id)
                        .single()
                    
                    if (school) {
                        setSchoolName(school.name.toUpperCase())
                    }
                }
            } catch (error) {
                console.error("Role check error:", error)
            } finally {
                setLoading(false)
            }
        }
        checkRole()
    }, [supabase])

    // Hareketsizlik Takibi
    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        const resetTimer = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                // alert("⚠️ Güvenlik uyarısı: Uzun süre işlem yapmadığınız için oturumunuz kapatıldı.");
                // handleLogout();
            }, TIMEOUT_DURATION);
        };

        const events = ['mousemove', 'keydown', 'click', 'scroll'];
        events.forEach(event => window.addEventListener(event, resetTimer));
        resetTimer();

        return () => {
            clearTimeout(timeoutId);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [handleLogout]);

    // Işık Efekti
    useEffect(() => {
        const updateMousePosition = (ev: MouseEvent) => {
            setMousePosition({ x: ev.clientX, y: ev.clientY })
        }
        window.addEventListener('mousemove', updateMousePosition)
        return () => window.removeEventListener('mousemove', updateMousePosition)
    }, [])

    // Tarih/Saat Güncelleme
    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date()
            const dateStr = now.toLocaleDateString('tr-TR', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                weekday: 'long'
            })
            const timeStr = now.toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit'
            })
            setCurrentDateTime(`${dateStr} ${timeStr}`)
        }
        updateDateTime()
        const interval = setInterval(updateDateTime, 1000)
        return () => clearInterval(interval)
    }, [])

    const getLinkClass = (path: string) => {
        const isActive = pathname === path
        const baseClass = "flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 font-medium "
        if (isActive) return baseClass + "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 translate-x-1"
        return baseClass + "text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1"
    }

    if (loading) return null // Veya loading spinner

    return (
        <div className="flex h-screen bg-black text-white font-sans relative overflow-hidden selection:bg-indigo-500/30">

            {/* IŞIK EFEKTİ */}
            <div
                className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
                style={{ background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.05), transparent 40%)` }}
            />

            {/* SOL MENÜ */}
            <aside className="w-72 bg-slate-950 border-r border-slate-900 flex flex-col shrink-0 z-10 relative">
                <div className="p-8 border-b border-slate-900">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent filter drop-shadow-lg flex items-center gap-2">
                        <Coffee className="text-indigo-500" />
                        {schoolName || 'SkyTech'}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 tracking-widest uppercase">
                        {userRole === 'admin' ? 'Yönetim Paneli' : userRole === 'canteen_staff' ? 'Kantin Paneli' : 'Panel'}
                    </p>
                    {currentDateTime && (
                        <div className="text-xs text-slate-600 mt-2 font-mono">
                            {currentDateTime}
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-6 space-y-2 overflow-y-auto">
                    {/* ORTAK LİNKLER */}
                    <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 pl-3">Genel</div>
                    <Link href="/dashboard" className={getLinkClass('/dashboard')}>
                        <LayoutDashboard size={20} /> <span>Ana Sayfa</span>
                    </Link>

                    {/* ADMIN LİNKLERİ - Sadece admin görsün */}
                    {(userRole === 'admin' || userRole === 'school_admin') && (
                        <>
                            <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 mt-8 pl-3">Yönetim</div>
                            <Link href="/dashboard/schools" className={getLinkClass('/dashboard/schools')}>
                                <School size={20} /> <span>Okullar</span>
                            </Link>
                            <Link href="/dashboard/campaigns" className={getLinkClass('/dashboard/campaigns')}>
                                <Bell size={20} /> <span>Kampanyalar</span>
                            </Link>
                            <Link href="/dashboard/settings" className={getLinkClass('/dashboard/settings')}>
                                <Settings size={20} /> <span>Ayarlar</span>
                            </Link>
                        </>
                    )}

                    {/* KANTİNCİ LİNKLERİ */}
                    {userRole === 'canteen_staff' && (
                        <>
                            <div className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-4 mt-8 pl-3">Operasyon</div>
                            <Link href="/dashboard/pos" className={getLinkClass('/dashboard/pos')}>
                                <ShoppingCart size={20} /> <span>Kasa / Satış</span>
                            </Link>
                            <Link href="/dashboard/products" className={getLinkClass('/dashboard/products')}>
                                <Package size={20} /> <span>Ürünler</span>
                            </Link>
                            <Link href="/dashboard/students" className={getLinkClass('/dashboard/students')}>
                                <Users size={20} /> <span>Öğrenciler</span>
                            </Link>
                            <Link href="/dashboard/transactions" className={getLinkClass('/dashboard/transactions')}>
                                <History size={20} /> <span>Geçmiş</span>
                            </Link>
                            <Link href="/dashboard/settings" className={getLinkClass('/dashboard/settings')}>
                                <Settings size={20} /> <span>Ayarlar</span>
                            </Link>
                        </>
                    )}
                </nav>

                {/* ÇIKIŞ BUTONU */}
                <div className="p-6 border-t border-slate-900">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-950/30 hover:border-red-900/50 transition-all group text-left"
                    >
                        <div className="w-10 h-10 rounded-lg bg-indigo-600/20 group-hover:bg-red-600/20 flex items-center justify-center font-bold text-indigo-400 group-hover:text-red-400 transition-colors">
                            <LogOut size={20} />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white group-hover:text-red-400">Çıkış Yap</div>
                            <div className="text-xs text-slate-500 group-hover:text-red-500/70">Oturumu Sonlandır</div>
                        </div>
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-transparent z-10 relative">

                {/* BİLDİRİM MERKEZİ (SADECE ADMIN) */}
                {(userRole === 'admin' || userRole === 'school_admin') && (
                    <div className="absolute top-6 right-6 z-50">
                        <button
                            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                            className="relative p-3 bg-slate-900/80 backdrop-blur-md rounded-full border border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500 transition-all shadow-lg"
                        >
                            <Bell size={20} />
                            {notifications.length > 0 && (
                                <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-pulse border-2 border-slate-900"></span>
                            )}
                        </button>

                        {/* DROPDOWN */}
                        {isNotificationOpen && (
                            <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
                                <div className="p-3 border-b border-slate-800 bg-slate-950/50">
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        <Bell size={14} className="text-indigo-500" />
                                        Bekleyen Ödemeler ({notifications.length})
                                    </h3>
                                </div>
                                <div className="max-h-64 overflow-y-auto">
                                    {notifications.length === 0 ? (
                                        <div className="p-4 text-center text-slate-500 text-xs">Bekleyen bildirim yok.</div>
                                    ) : (
                                        notifications.map(n => (
                                            <div key={n.id} className="p-3 border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-bold text-white">{n.schools?.name}</span>
                                                    <span className="text-xs text-slate-500">{new Date(n.created_at).toLocaleDateString('tr-TR')}</span>
                                                </div>
                                                <div className="text-lg font-bold text-green-400 mb-2">₺{n.amount}</div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleApprove(n.id)}
                                                        className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1 rounded text-xs font-bold flex items-center justify-center gap-1"
                                                    >
                                                        <Check size={12} /> Onayla
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(n.id)}
                                                        className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white py-1 rounded text-xs font-bold flex items-center justify-center gap-1"
                                                    >
                                                        <X size={12} /> Red
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {children}
            </main>
        </div>
    )
}
