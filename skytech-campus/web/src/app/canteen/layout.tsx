'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import {
    LayoutDashboard, ShoppingCart, Package, Users, History,
    LogOut, Menu, X, Briefcase, School, Settings, Truck, Wallet, FileText, Calendar
} from 'lucide-react'

export default function CanteenLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
    const [schoolName, setSchoolName] = useState<string>('')
    const [userRole, setUserRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentDateTime, setCurrentDateTime] = useState<string>('')
    
    // URL'den schoolId parametresini al (yönetici için)
    const schoolId = searchParams.get('schoolId')

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }, [router, supabase.auth])

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

    // GÜVENLİK KONTROLÜ ve OKUL ADI ÇEKME
    useEffect(() => {
        const checkAuthAndSchool = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user || !user.email) return

                // 1. Rolü Çek
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single()

                const role = profile?.role || 'student'
                setUserRole(role)

                // 2. Admin ise Okul Kontrolünü Atla (CRITICAL FIX)
                if (role === 'admin') {
                    setSchoolName('SKYTECH YÖNETİM')
                    setLoading(false)
                    return
                }

                // 3. Kantinci ise Okul Bilgisini Çek
                const { data: school } = await supabase
                    .from('schools')
                    .select('name, is_active')
                    .eq('canteen_email', user.email)
                    .single()

                if (school) {
                    // Okul Pasifse At
                    if (school.is_active === false) {
                        alert("Okulunuzun erişimi yönetim tarafından durdurulmuştur. Oturum kapatılıyor.")
                        handleLogout()
                        return
                    }
                    setSchoolName(school.name.toUpperCase())
                }
            } catch (error) {
                console.error("Auth check error:", error)
            } finally {
                setLoading(false)
            }
        }

        checkAuthAndSchool()
    }, [pathname, supabase, handleLogout])

    const getLinkClass = (path: string) => {
        const isActive = pathname === path
        const baseClass = "flex items-center gap-3 px-3 py-2 rounded transition-all duration-200 "
        if (isActive) return baseClass + "bg-orange-600 text-white font-bold shadow-lg shadow-orange-900/20 translate-x-1"
        return baseClass + "text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1"
    }

    // Link'e schoolId parametresini ekle (yönetici için)
    const getLinkHref = (path: string) => {
        if (schoolId) {
            return `${path}?schoolId=${schoolId}`
        }
        return path
    }

    return (
        <div className="flex h-screen bg-slate-950 text-white font-sans relative overflow-hidden selection:bg-orange-500/30">

            {/* IŞIK EFEKTİ (Turuncu Tonlu) */}
            <div
                className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-500"
                style={{ background: `radial-gradient(150px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(249, 115, 22, 0.15), transparent 90%)` }}
            />

            {/* SOL MENÜ */}
            <aside className="w-64 bg-slate-900/80 backdrop-blur-md border-r border-slate-800 flex flex-col shrink-0 z-10 relative">
                <div className="p-6 border-b border-slate-800">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent filter drop-shadow-lg break-words leading-tight">
                        {schoolName || 'YÜKLENİYOR...'}
                    </h1>
                    {userRole === 'admin' && <span className="text-xs text-orange-500 font-mono mt-1 block">YÖNETİCİ MODU</span>}
                    {currentDateTime && (
                        <div className="text-xs text-slate-500 mt-2 font-mono">
                            {currentDateTime}
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {/* ADMIN İÇİN GENEL MENÜ */}
                    {userRole === 'admin' && (
                        <>
                            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 pl-3">Genel</div>
                            <Link href="/dashboard" className={getLinkClass('/dashboard')}>
                                <LayoutDashboard size={20} /> <span>Ana Sayfa</span>
                            </Link>
                            <Link href="/dashboard/schools" className={getLinkClass('/dashboard/schools')}>
                                <School size={20} /> <span>Okullar</span>
                            </Link>
                            <div className="my-4 border-t border-slate-800/50"></div>
                        </>
                    )}

                    {/* KANTİN İŞLEMLERİ (HERKES GÖRÜR) */}
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2 pl-3">Kantin İşlemleri</div>

                    {/* Admin için Dashboard linki zaten yukarıda var, kantinci için buraya ekleyebiliriz veya admin için gizleyebiliriz. 
                        Kullanıcı isteğinde Admin için "Kasa / Satış"tan başlasın denmiş ama "Ana Sayfa" da istendi.
                        Kantin Dashboard'u (/canteen) admin için opsiyonel olabilir ama listede yoktu. 
                        İstenen listeye sadık kalıyorum. */}

                    {userRole !== 'admin' && (
                        <Link href={getLinkHref("/canteen")} className={getLinkClass('/canteen')}><span>📊</span> Özet (Dashboard)</Link>
                    )}

                    <Link href={getLinkHref("/canteen/pos")} className={getLinkClass('/canteen/pos')}>
                        <ShoppingCart size={20} /> <span>Kasa / Satış</span>
                    </Link>
                    <Link href={getLinkHref("/canteen/products")} className={getLinkClass('/canteen/products')}>
                        <Package size={20} /> <span>Ürünler</span>
                    </Link>
                    <Link href={getLinkHref("/canteen/suppliers")} className={getLinkClass('/canteen/suppliers')}>
                        <Truck size={20} /> <span>Firmalar</span>
                    </Link>
                    <Link href={getLinkHref("/canteen/orders")} className={getLinkClass('/canteen/orders')}>
                        <Package size={20} /> <span>Siparişler</span>
                    </Link>
                    <Link href={getLinkHref("/canteen/etut-menu")} className={getLinkClass('/canteen/etut-menu')}>
                        <Calendar size={20} /> <span>Etüt Menüsü</span>
                    </Link>
                    <Link href={getLinkHref("/canteen/expenses")} className={getLinkClass('/canteen/expenses')}>
                        <Wallet size={20} /> <span>Giderler</span>
                    </Link>

                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 pl-3">Müşteriler</div>
                    <Link href={getLinkHref("/canteen/students")} className={getLinkClass('/canteen/students')}>
                        <Users size={20} /> <span>Öğrenci Sorgula</span>
                    </Link>
                    <Link href={getLinkHref("/canteen/personnel")} className={getLinkClass('/canteen/personnel')}>
                        <Briefcase size={20} /> <span>Personel</span>
                    </Link>
                    <Link href={getLinkHref("/canteen/history")} className={getLinkClass('/canteen/history')}>
                        <History size={20} /> <span>Geçmiş</span>
                    </Link>

                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6 pl-3">Yönetim</div>
                    <Link href="/canteen/settings" className={getLinkClass('/canteen/settings')}>
                        <Settings size={20} /> <span>Ayarlar</span>
                    </Link>
                </nav>

                {/* ÇIKIŞ BUTONU */}
                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:bg-red-900/20 hover:border-red-500/50 transition-all group text-left"
                    >
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white shadow-inner transition-colors ${userRole === 'admin' ? 'bg-indigo-600 group-hover:bg-red-600' : 'bg-orange-600 group-hover:bg-red-600'}`}>
                            {userRole === 'admin' ? 'A' : 'K'}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white group-hover:text-red-400">Çıkış Yap</div>
                            <div className="text-xs text-slate-500 group-hover:text-red-300">
                                {userRole === 'admin' ? 'Yönetici' : 'Kantin Personeli'}
                            </div>
                        </div>
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto bg-transparent z-10 relative">
                {children}
            </main>
        </div>
    )
}
