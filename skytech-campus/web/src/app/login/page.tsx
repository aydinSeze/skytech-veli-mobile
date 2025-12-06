'use client'

import { createClient } from '@/utils/supabase/client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    // Yükleniyor durumu (Butonu kilitlemek için kritik)
    const [loading, setLoading] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)

    const searchParams = useSearchParams()
    const supabase = createClient()

    const handleLogin = async (e: React.FormEvent) => {
        // 1. Sayfa yenilenmesini engelle
        e.preventDefault()

        // 2. Eğer zaten yükleniyorsa dur (Çift tıklama koruması)
        if (loading) return

        // 3. Butonu kilitle
        setLoading(true)
        setErrorMsg(null)

        console.log("Giriş işlemi başlatıldı...")

        try {
            // 4. Tek bir istek at
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                console.error("Giriş Hatası:", error)
                alert("Giriş Başarısız: " + error.message)
                setErrorMsg(error.message)
                setLoading(false) // Hata varsa butonu tekrar aç
                return
            }

            if (data.user) {
                console.log("Kullanıcı doğrulandı. Rol ve Okul durumu kontrol ediliyor...")

                // 5. Hızlı admin kontrolü (email bazlı fallback)
                const isAdminEmail = data.user.email === 'admin@skytech.com' || data.user.email?.includes('admin')

                // Profil ve Rol Bilgisini Çek (school_id dahil)
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role, school_id')
                    .eq('id', data.user.id)
                    .single()

                // Admin için profil hatası tolere edilebilir
                let role = profile?.role
                
                // FALLBACK: Profil yoksa veya hata varsa ama email admin ise
                if ((profileError || !profile) && isAdminEmail) {
                    console.log("Profil bulunamadı ama admin email tespit edildi, admin olarak devam ediliyor...")
                    role = 'admin'
                } else if (profileError && !isAdminEmail) {
                    console.error("Profil Hatası:", profileError)
                    alert("Profil bilgisi alınamadı. Lütfen yönetici ile iletişime geçin.")
                    await supabase.auth.signOut() // Güvenlik için çıkış yap
                    setLoading(false)
                    return
                } else {
                    role = profile?.role || 'student'
                }

                console.log("Tespit Edilen Rol:", role)

                // 6. KANTİN PERSONELİ İÇİN SIKI GÜVENLİK KONTROLÜ
                if (role === 'canteen_staff') {
                    let schoolIsActive = true;

                    // A. Önce profile'daki school_id ile kontrol et
                    if (profile.school_id) {
                        const { data: school } = await supabase
                            .from('schools')
                            .select('is_active')
                            .eq('id', profile.school_id)
                            .single()

                        if (school) schoolIsActive = school.is_active;
                    }
                    // B. Yoksa email ile kontrol et (Fallback)
                    else {
                        const { data: schoolByEmail } = await supabase
                            .from('schools')
                            .select('is_active')
                            .eq('canteen_email', email)
                            .single()

                        if (schoolByEmail) schoolIsActive = schoolByEmail.is_active;
                    }

                    // C. KRİTİK KONTROL: Eğer okul pasifse
                    if (schoolIsActive === false) {
                        console.warn("GÜVENLİK UYARISI: Pasif okul personeli giriş yapmaya çalıştı.")
                        await supabase.auth.signOut() // HEMEN ÇIKIŞ YAP
                        alert("Erişim Engellendi: Okulunuzun sistemi yönetim tarafından durdurulmuştur.")
                        setErrorMsg("Erişim Engellendi: Okul Pasif")
                        setLoading(false)
                        return // ASLA YÖNLENDİRME YAPMA
                    }
                }

                // 7. Her şey yolundaysa yönlendir
                // Redirect parametresini kontrol et
                const redirectPath = searchParams.get('redirect') || null

                if (role === 'admin' || role === 'school_admin') {
                    // Admin için redirect parametresi varsa oraya, yoksa dashboard'a git
                    const targetPath = redirectPath && redirectPath.startsWith('/dashboard') 
                        ? redirectPath 
                        : '/dashboard'
                    
                    // Yönlendirme için window.location kullan (daha güvenilir)
                    window.location.href = targetPath
                } else if (role === 'canteen_staff') {
                    window.location.href = '/canteen'
                } else {
                    console.warn("Yetkisiz rol:", role)
                    await supabase.auth.signOut()
                    alert("Bu panele sadece yetkili personel girebilir.")
                    setErrorMsg("Yetkisiz Giriş")
                    setLoading(false)
                    return
                }

                // Loading state'i temizleme - yönlendirme yapıldığı için gerek yok
                // Sayfa değişeceği için state temizlenmesine gerek yok
            } else {
                // User yoksa
                setErrorMsg("Giriş başarısız. Lütfen bilgilerinizi kontrol edin.")
                setLoading(false)
            }
        } catch (err: any) {
            console.error("Beklenmeyen Hata:", err)
            setErrorMsg("Bir hata oluştu: " + (err.message || 'Bilinmeyen hata'))
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden">

            {/* Arka Plan Efektleri */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <div className="absolute w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl -top-20 -left-20 animate-pulse"></div>

            {/* Login Kartı */}
            <div className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-md relative z-10">

                <div className="flex flex-col items-center mb-8">
                    <img
                        src="/logo.png"
                        alt="SkyTech Logo"
                        className="w-64 h-auto object-contain drop-shadow-2xl mb-6 hover:scale-110 transition-transform duration-300"
                    />
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                        SkyTech Campus
                    </h1>
                    <p className="text-slate-400 text-sm">Yönetim Paneli Girişi</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">E-posta Adresi</label>
                        <input
                            type="email" required
                            className="w-full bg-slate-950 text-white p-3 rounded-lg border border-slate-700 focus:border-yellow-500 outline-none transition-all disabled:opacity-50"
                            placeholder="admin@skytech.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading} // Yüklenirken inputu kilitle
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Şifre</label>
                        <input
                            type="password" required
                            className="w-full bg-slate-950 text-white p-3 rounded-lg border border-slate-700 focus:border-yellow-500 outline-none transition-all disabled:opacity-50"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading} // Yüklenirken inputu kilitle
                        />
                    </div>

                    {errorMsg && (
                        <div className="bg-red-900/30 text-red-400 text-sm p-3 rounded border border-red-900/50 text-center">
                            {errorMsg}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading} // TIKLANDIĞI AN KİLİTLENİR
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-lg font-bold transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Giriş Yapılıyor...
                            </span>
                        ) : 'Giriş Yap'}
                    </button>
                </form>
            </div>
        </div>
    )
}
