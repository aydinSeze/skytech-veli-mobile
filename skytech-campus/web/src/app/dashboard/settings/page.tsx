'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Settings, DollarSign, Save, AlertCircle, Edit2 } from 'lucide-react'
import { toast } from 'sonner'

interface CommissionRule {
    id: string
    min_price: number
    max_price: number | null
    commission_amount: number
    priority: number
}

export default function AdminSettings() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [rules, setRules] = useState<CommissionRule[]>([])
    const [editingRule, setEditingRule] = useState<string | null>(null)
    const [editingPriceRange, setEditingPriceRange] = useState<string | null>(null)
    const [editAmount, setEditAmount] = useState<number>(0)
    const [editMinPrice, setEditMinPrice] = useState<number>(0)
    const [editMaxPrice, setEditMaxPrice] = useState<number | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setMessage({ type: 'error', text: 'Oturum açılmamış.' })
                return
            }

            // Admin kontrolü
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            const userRole = profile?.role || (user.email === 'admin@skytech.com' || user.email?.includes('admin') ? 'admin' : null)

            if (userRole !== 'admin') {
                setMessage({ type: 'error', text: 'Bu sayfaya erişim yetkiniz yok.' })
                return
            }

            // Komisyon kurallarını çek (sadece 3 varsayılan kural)
            let { data: rulesData, error: rulesError } = await supabase
                .from('commission_rules')
                .select('*')
                .eq('is_active', true)
                .order('min_price', { ascending: true })

            if (rulesError) {
                console.error('Komisyon kuralları çekilirken hata:', rulesError)
            }

            // Eğer kurallar yoksa veya 3'ten azsa varsayılanları oluştur
            if (!rulesData || rulesData.length < 3) {
                await createDefaultRules()
                // Tekrar çek
                const { data: newRules } = await supabase
                    .from('commission_rules')
                    .select('*')
                    .eq('is_active', true)
                    .order('min_price', { ascending: true })
                
                if (newRules && newRules.length >= 3) {
                    setRules(newRules.slice(0, 3))
                } else {
                    // Hala yoksa manuel olarak oluştur
                    const manualRules: CommissionRule[] = [
                        { id: 'temp-1', min_price: 0, max_price: 40, commission_amount: 0.10, priority: 1 },
                        { id: 'temp-2', min_price: 41, max_price: 100, commission_amount: 0.20, priority: 2 },
                        { id: 'temp-3', min_price: 101, max_price: null, commission_amount: 0.40, priority: 3 }
                    ]
                    setRules(manualRules)
                }
            } else {
                setRules(rulesData.slice(0, 3))
            }
        } catch (error) {
            console.error('Ayarlar yüklenirken hata:', error)
            setMessage({ type: 'error', text: 'Ayarlar yüklenirken bir hata oluştu.' })
        } finally {
            setLoading(false)
        }
    }

    const createDefaultRules = async () => {
        const defaultRules = [
            { min_price: 0, max_price: 40, commission_amount: 0.10, priority: 1, is_active: true },
            { min_price: 41, max_price: 100, commission_amount: 0.20, priority: 2, is_active: true },
            { min_price: 101, max_price: null, commission_amount: 0.40, priority: 3, is_active: true }
        ]

        // Önce mevcut kuralları kontrol et
        const { data: existing } = await supabase
            .from('commission_rules')
            .select('*')
            .eq('is_active', true)

        // Eğer 3 kural yoksa veya fiyat aralıkları farklıysa güncelle
        if (!existing || existing.length < 3) {
            // Tüm aktif kuralları sil ve yenilerini ekle
            await supabase.from('commission_rules').update({ is_active: false }).eq('is_active', true)
            
            for (const rule of defaultRules) {
                await supabase.from('commission_rules').insert([rule])
            }
        } else {
            // Mevcut kuralları güncelle
            const sortedExisting = existing.sort((a, b) => a.min_price - b.min_price)
            for (let i = 0; i < defaultRules.length && i < sortedExisting.length; i++) {
                await supabase
                    .from('commission_rules')
                    .update({ 
                        min_price: defaultRules[i].min_price,
                        max_price: defaultRules[i].max_price,
                        commission_amount: defaultRules[i].commission_amount,
                        priority: defaultRules[i].priority,
                        is_active: true
                    })
                    .eq('id', sortedExisting[i].id)
            }
        }
    }

    const handleUpdateRule = async (ruleId: string) => {
        if (editAmount <= 0) {
            setMessage({ type: 'error', text: 'Komisyon tutarı 0\'dan büyük olmalıdır.' })
            return
        }

        setSaving(true)
        setMessage(null)

        try {
            // Eğer geçici ID ise (temp- ile başlıyorsa), önce veritabanında oluştur
            if (ruleId.startsWith('temp-')) {
                const ruleToInsert = {
                    min_price: editMinPrice,
                    max_price: editMaxPrice,
                    commission_amount: editAmount,
                    priority: parseInt(ruleId.split('-')[1]),
                    is_active: true
                }
                
                const { data: inserted, error: insertError } = await supabase
                    .from('commission_rules')
                    .insert([ruleToInsert])
                    .select()
                    .single()

                if (insertError) {
                    setMessage({ type: 'error', text: 'Güncelleme sırasında bir hata oluştu: ' + insertError.message })
                    return
                }

                ruleId = inserted.id
            } else {
                const { error } = await supabase
                    .from('commission_rules')
                    .update({ commission_amount: editAmount })
                    .eq('id', ruleId)

                if (error) {
                    setMessage({ type: 'error', text: 'Güncelleme sırasında bir hata oluştu: ' + error.message })
                    return
                }
            }

            setMessage({ type: 'success', text: 'Komisyon kuralı başarıyla güncellendi! Tüm okullara uygulandı.' })
            toast.success('Kural güncellendi!')
            setEditingRule(null)
            setEditAmount(0)
            fetchSettings()
        } catch (error: any) {
            console.error('Kural güncellenirken hata:', error)
            setMessage({ type: 'error', text: 'Kural güncellenirken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata') })
        } finally {
            setSaving(false)
        }
    }

    const handleUpdatePriceRange = async (ruleId: string) => {
        if (editMinPrice < 0) {
            setMessage({ type: 'error', text: 'Minimum fiyat 0\'dan küçük olamaz.' })
            return
        }
        if (editMaxPrice !== null && editMaxPrice <= editMinPrice) {
            setMessage({ type: 'error', text: 'Maximum fiyat minimum fiyattan büyük olmalıdır.' })
            return
        }

        setSaving(true)
        setMessage(null)

        try {
            // Eğer geçici ID ise (temp- ile başlıyorsa), önce veritabanında oluştur
            if (ruleId.startsWith('temp-')) {
                const rule = rules.find(r => r.id === ruleId)
                if (!rule) return
                
                const ruleToInsert = {
                    min_price: editMinPrice,
                    max_price: editMaxPrice,
                    commission_amount: rule.commission_amount,
                    priority: parseInt(ruleId.split('-')[1]),
                    is_active: true
                }
                
                const { data: inserted, error: insertError } = await supabase
                    .from('commission_rules')
                    .insert([ruleToInsert])
                    .select()
                    .single()

                if (insertError) {
                    setMessage({ type: 'error', text: 'Güncelleme sırasında bir hata oluştu: ' + insertError.message })
                    return
                }

                ruleId = inserted.id
            } else {
                const { error } = await supabase
                    .from('commission_rules')
                    .update({ 
                        min_price: editMinPrice,
                        max_price: editMaxPrice
                    })
                    .eq('id', ruleId)

                if (error) {
                    setMessage({ type: 'error', text: 'Güncelleme sırasında bir hata oluştu: ' + error.message })
                    return
                }
            }

            setMessage({ type: 'success', text: 'Fiyat aralığı başarıyla güncellendi! Tüm okullara uygulandı.' })
            toast.success('Fiyat aralığı güncellendi!')
            setEditingPriceRange(null)
            setEditMinPrice(0)
            setEditMaxPrice(null)
            fetchSettings()
        } catch (error: any) {
            console.error('Fiyat aralığı güncellenirken hata:', error)
            setMessage({ type: 'error', text: 'Fiyat aralığı güncellenirken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata') })
        } finally {
            setSaving(false)
        }
    }

    const getRuleLabel = (rule: CommissionRule) => {
        if (rule.max_price === null) {
            return `${rule.min_price} TL ve Üzeri`
        }
        return `${rule.min_price} TL - ${rule.max_price} TL`
    }

    if (loading) {
        return (
            <div className="p-10 flex items-center justify-center min-h-screen">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-t-indigo-500 border-b-2 border-b-transparent mx-auto"></div>
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
                    <Settings size={24} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white">Yönetim Paneli Ayarları</h1>
                    <p className="text-slate-400 text-sm">Komisyon kurallarını yönetin</p>
                </div>
            </div>

            {/* UYARI MESAJI */}
            {message && (
                <div className={`p-4 rounded-xl border ${
                    message.type === 'success' 
                        ? 'bg-green-900/20 border-green-700 text-green-300' 
                        : 'bg-red-900/20 border-red-700 text-red-300'
                } flex items-start gap-3`}>
                    <AlertCircle size={20} className="mt-0.5" />
                    <div>
                        <p className="font-medium">{message.text}</p>
                    </div>
                </div>
            )}

            {/* KOMMİSYON KURALLARI */}
            <div className="max-w-4xl space-y-4">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">Fiyat Bazlı Komisyon Kuralları</h2>
                        <p className="text-slate-400 text-sm">Ürün fiyatına göre komisyon tutarlarını belirleyin</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {rules.length > 0 ? rules.map((rule) => (
                        <div key={rule.id} className="bg-slate-900/50 p-6 rounded-xl border border-slate-800">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 flex-1">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                        <DollarSign size={20} />
                                    </div>
                                    {editingPriceRange === rule.id ? (
                                        <div className="flex-1 space-y-2">
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    className="w-20 bg-slate-800 border border-slate-700 text-white p-1.5 rounded text-xs"
                                                    value={editMinPrice}
                                                    onChange={(e) => setEditMinPrice(parseInt(e.target.value) || 0)}
                                                    placeholder="Min"
                                                />
                                                <span className="text-slate-400 text-xs">-</span>
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    className="w-24 bg-slate-800 border border-slate-700 text-white p-1.5 rounded text-xs"
                                                    value={editMaxPrice || ''}
                                                    onChange={(e) => setEditMaxPrice(e.target.value ? parseInt(e.target.value) : null)}
                                                    placeholder="Max"
                                                />
                                                <span className="text-slate-400 text-xs">TL</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => {
                                                        setEditingPriceRange(null)
                                                        setEditMinPrice(0)
                                                        setEditMaxPrice(null)
                                                    }}
                                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-1 rounded text-xs font-bold"
                                                >
                                                    İptal
                                                </button>
                                                <button
                                                    onClick={() => handleUpdatePriceRange(rule.id)}
                                                    disabled={saving}
                                                    className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white py-1 rounded text-xs font-bold"
                                                >
                                                    {saving ? '...' : 'Kaydet'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <div className="text-sm font-bold text-white">{getRuleLabel(rule)}</div>
                                                <button
                                                    onClick={() => {
                                                        setEditingPriceRange(rule.id)
                                                        setEditMinPrice(rule.min_price)
                                                        setEditMaxPrice(rule.max_price)
                                                    }}
                                                    className="text-blue-400 hover:text-blue-300 p-0.5 hover:bg-blue-500/10 rounded"
                                                    title="Fiyat aralığını düzenle"
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                            </div>
                                            <div className="text-xs text-slate-400">Fiyat Aralığı</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {editingRule === rule.id ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Komisyon Tutarı (₺)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-lg text-sm"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                                            placeholder="0.10"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setEditingRule(null)
                                                setEditAmount(0)
                                            }}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-xs font-bold"
                                        >
                                            İptal
                                        </button>
                                        <button
                                            onClick={() => handleUpdateRule(rule.id)}
                                            disabled={saving}
                                            className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 text-white py-2 rounded-lg text-xs font-bold"
                                        >
                                            {saving ? 'Kaydediliyor...' : 'Güncelle'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="bg-slate-800/50 p-3 rounded-lg">
                                        <div className="text-xs text-slate-400 mb-1">Komisyon Tutarı</div>
                                        <div className="text-2xl font-bold text-green-400">₺{rule.commission_amount.toFixed(2)}</div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingRule(rule.id)
                                            setEditAmount(rule.commission_amount)
                                        }}
                                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                                    >
                                        <Edit2 size={14} />
                                        Düzenle
                                    </button>
                                </div>
                            )}
                        </div>
                    )) : (
                        <div className="col-span-3 text-center py-8 text-slate-500">
                            Kurallar yükleniyor...
                        </div>
                    )}
                </div>

                <div className="bg-blue-900/20 border border-blue-700/50 p-4 rounded-lg">
                    <p className="text-sm text-blue-300">
                        <strong>ℹ️ Bilgi:</strong> Komisyon kuralları tüm okullara otomatik olarak uygulanır. 
                        Yaptığınız değişiklikler anında tüm satış işlemlerinde geçerli olacaktır.
                    </p>
                </div>
            </div>
        </div>
    )
}
