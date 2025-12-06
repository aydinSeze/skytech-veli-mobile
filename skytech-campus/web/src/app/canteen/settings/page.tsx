'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import { Save, Lock, ShieldCheck, AlertCircle, HelpCircle } from 'lucide-react'
import { updateSchoolPin } from '@/actions/school-actions'
import { toast } from 'sonner'

export const dynamic = 'force-dynamic'

export default function CanteenSettings() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [hasPin, setHasPin] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
            if (!profile?.school_id) return

            // PIN var mı yok mu kontrol et
            const { data: school, error: schoolError } = await supabase
                .from('schools')
                .select('privacy_pin')
                .eq('id', profile.school_id)
                .single()

            if (schoolError) {
                console.error("Okul bilgisi alınamadı:", schoolError)
                return
            }

            // PIN varsa (null değilse, undefined değilse ve boş string değilse) hasPin = true
            const pinExists = school?.privacy_pin !== null && 
                             school?.privacy_pin !== undefined && 
                             String(school.privacy_pin).trim() !== ''
            
            console.log("PIN Kontrolü:", { 
                privacy_pin: school?.privacy_pin, 
                pinExists,
                hasPin: pinExists 
            })
            
            setHasPin(pinExists)
        } catch (error) {
            console.error("Ayarlar yüklenirken hata:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (formData: FormData) => {
        setSaving(true)
        setMessage(null)

        try {
            // Form validasyonu
            const currentPin = formData.get('currentPin') as string
            const newPin = formData.get('newPin') as string
            const confirmPin = formData.get('confirmPin') as string

            // PIN varsa eski şifre zorunlu
            if (hasPin && !currentPin) {
                setMessage({ type: 'error', text: 'Mevcut şifre gereklidir.' })
                setSaving(false)
                return
            }

            // Yeni şifre ve tekrar eşleşmeli
            if (newPin !== confirmPin) {
                setMessage({ type: 'error', text: 'Yeni şifreler eşleşmiyor.' })
                setSaving(false)
                return
            }

            // Şifre 4 haneli olmalı
            if (newPin.length !== 4) {
                setMessage({ type: 'error', text: 'Şifre 4 haneli olmalıdır.' })
                setSaving(false)
                return
            }

            const result = await updateSchoolPin(null, formData)

            if (result.success) {
                setMessage({ type: 'success', text: result.message || 'Şifre başarıyla güncellendi!' })
                setHasPin(true)
                // Formu temizle
                const form = document.getElementById('pinForm') as HTMLFormElement
                if (form) form.reset()
                // Ayarları yeniden yükle
                await fetchSettings()
            } else {
                setMessage({ type: 'error', text: result.error || 'Bir hata oluştu.' })
            }
        } catch (error) {
            console.error('Şifre güncelleme hatası:', error)
            setMessage({ type: 'error', text: 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.' })
        } finally {
            setSaving(false)
        }
    }

    const handleForgotPassword = () => {
        toast.info("Şifrenizi unuttuysanız, yönetim panelinden şifreniz 0000 olarak sıfırlanacaktır. Lütfen SkyTech Yönetimi ile iletişime geçiniz.")
    }

    if (loading) {
        return (
            <div className="p-10 flex items-center justify-center min-h-screen">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                    <p className="text-slate-400">Ayarlar yükleniyor...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            {/* BAŞLIK */}
            <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Kantin Ayarları</h1>
                    <p className="text-slate-400 text-sm">Güvenlik ve tercihlerinizi yönetin.</p>
                </div>
            </div>

            {/* GÜVENLİK AYARLARI KARTI */}
            <div className="max-w-2xl">
                <div className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden">
                    <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex items-center gap-2">
                        <Lock size={18} className="text-amber-500" />
                        <h2 className="font-bold text-white">
                            {hasPin ? 'Finansal Şifre Güncelle' : 'Finansal Şifre Oluştur'}
                        </h2>
                    </div>

                    <div className="p-6 space-y-6">
                        <form id="pinForm" action={handleSubmit} className="space-y-4">

                            {/* PIN varsa eski şifre ZORUNLU - Her zaman göster (PIN yoksa backend'de kontrol edilir) */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-300">
                                    Mevcut Şifre {hasPin && <span className="text-red-400">*</span>}
                                    {!hasPin && <span className="text-slate-500 text-xs">(Opsiyonel - İlk kez şifre oluşturuyorsanız boş bırakabilirsiniz)</span>}
                                </label>
                                <input
                                    type="password"
                                    name="currentPin"
                                    maxLength={4}
                                    minLength={4}
                                    pattern="[0-9]{4}"
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 tracking-widest font-mono"
                                    placeholder="****"
                                    required={hasPin}
                                    autoComplete="current-password"
                                />
                                {hasPin && (
                                    <p className="text-xs text-slate-500">Şifrenizi değiştirmek için mevcut şifrenizi girmeniz gerekmektedir.</p>
                                )}
                                {!hasPin && (
                                    <p className="text-xs text-slate-500">İlk kez şifre oluşturuyorsanız bu alanı boş bırakabilirsiniz.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">
                                        Yeni Şifre (4 Haneli) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="newPin"
                                        maxLength={4}
                                        minLength={4}
                                        pattern="[0-9]{4}"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 tracking-widest font-mono"
                                        placeholder="****"
                                        required
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-slate-300">
                                        Yeni Şifre Tekrar <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        type="password"
                                        name="confirmPin"
                                        maxLength={4}
                                        minLength={4}
                                        pattern="[0-9]{4}"
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-indigo-500 tracking-widest font-mono"
                                        placeholder="****"
                                        required
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>

                            {/* MESAJ ALANI */}
                            {message && (
                                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    {message.type === 'success' ? <ShieldCheck size={16} /> : <AlertCircle size={16} />}
                                    {message.text}
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    className="text-sm text-slate-500 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                                >
                                    <HelpCircle size={14} />
                                    Şifremi Unuttum
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <>İşleniyor...</>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            {hasPin ? 'Güncelle' : 'Oluştur'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}
