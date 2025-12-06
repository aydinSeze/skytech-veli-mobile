'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Upload, X, Edit2, Trash2, Check, Image as ImageIcon, Link as LinkIcon, AlertCircle } from 'lucide-react'

export default function CampaignsPage() {
    const supabase = createClient()
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    const [form, setForm] = useState({
        title: '',
        target_link: '',
        image_url: '',
        is_active: false
    })

    // Verileri çek
    const fetchCampaigns = async () => {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) {
                // Tablo yoksa daha açıklayıcı mesaj
                if (error.message?.includes('could not find') || error.message?.includes('does not exist') || error.code === 'PGRST116') {
                    throw new Error('Announcements tablosu bulunamadı. Lütfen CREATE_CAMPAIGN_SYSTEM.sql dosyasını Supabase SQL Editor\'de çalıştırın.')
                }
                throw error
            }
            setCampaigns(data || [])
        } catch (error: any) {
            console.error('Kampanya çekme hatası:', error)
            const errorMessage = error.message || 'Bilinmeyen bir hata oluştu'
            setMessage({ type: 'error', text: `Kampanyalar yüklenemedi: ${errorMessage}` })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCampaigns()
    }, [])

    // Resim yükleme
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Dosya tipi kontrolü
        if (!file.type.startsWith('image/')) {
            setMessage({ type: 'error', text: 'Lütfen bir resim dosyası seçin!' })
            return
        }

        // Dosya boyutu kontrolü (5MB)
        if (file.size > 5 * 1024 * 1024) {
            setMessage({ type: 'error', text: 'Resim boyutu 5MB\'dan küçük olmalıdır!' })
            return
        }

        setUploading(true)
        try {
            // Dosya adını benzersiz yap
            const fileExt = file.name.split('.').pop()
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
            const filePath = fileName

            // Supabase Storage'a yükle
            const { error: uploadError } = await supabase.storage
                .from('campaigns')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                })

            if (uploadError) {
                // Bucket yoksa daha açıklayıcı mesaj
                if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('not found')) {
                    throw new Error('Storage bucket bulunamadı. Lütfen Supabase Dashboard -> Storage -> "New bucket" -> Name: "campaigns", Public: true -> Create bucket adımlarını takip edin.')
                }
                throw uploadError
            }

            // Public URL al
            const { data: { publicUrl } } = supabase.storage
                .from('campaigns')
                .getPublicUrl(filePath)

            setForm({ ...form, image_url: publicUrl })
            setPreviewImage(publicUrl)
            setMessage({ type: 'success', text: 'Resim başarıyla yüklendi!' })
        } catch (error: any) {
            console.error('Resim yükleme hatası:', error)
            const errorMessage = error.message || 'Bilinmeyen bir hata oluştu'
            setMessage({ type: 'error', text: `Resim yüklenemedi: ${errorMessage}` })
        } finally {
            setUploading(false)
        }
    }

    // Kaydet
    const handleSave = async () => {
        if (!form.title || !form.target_link || !form.image_url) {
            setMessage({ type: 'error', text: 'Lütfen tüm alanları doldurun!' })
            return
        }

        // URL formatı kontrolü
        try {
            new URL(form.target_link)
        } catch {
            setMessage({ type: 'error', text: 'Geçerli bir URL girin! (örn: https://example.com)' })
            return
        }

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
                throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
            }

            // Admin kontrolü (debug için)
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (profileError) {
                console.error('Profil çekme hatası:', profileError)
            }

            if (profile?.role !== 'admin') {
                throw new Error(`Yetkiniz yok! Admin rolü gerekiyor. Mevcut rolünüz: ${profile?.role || 'bulunamadı'}. Lütfen profil tablosunda role = 'admin' olduğundan emin olun.`)
            }

            const data = {
                ...form,
                created_by: user.id
            }

            if (editingId) {
                const { error } = await supabase
                    .from('announcements')
                    .update(data)
                    .eq('id', editingId)

                if (error) {
                    // RLS hatası kontrolü
                    if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
                        throw new Error(`RLS Politikası Hatası: ${error.message}. Lütfen CREATE_CAMPAIGN_SYSTEM.sql dosyasını çalıştırdığınızdan emin olun.`)
                    }
                    throw error
                }
                setMessage({ type: 'success', text: 'Kampanya güncellendi!' })
            } else {
                const { error } = await supabase
                    .from('announcements')
                    .insert([data])

                if (error) {
                    // RLS hatası kontrolü
                    if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
                        throw new Error(`RLS Politikası Hatası: ${error.message}. Lütfen CREATE_CAMPAIGN_SYSTEM.sql dosyasını çalıştırdığınızdan emin olun.`)
                    }
                    // Tablo yoksa
                    if (error.message?.includes('could not find') || error.message?.includes('does not exist')) {
                        throw new Error('Announcements tablosu bulunamadı. Lütfen CREATE_CAMPAIGN_SYSTEM.sql dosyasını Supabase SQL Editor\'de çalıştırın.')
                    }
                    throw error
                }
                setMessage({ type: 'success', text: 'Kampanya eklendi!' })
            }

            setIsModalOpen(false)
            setEditingId(null)
            setForm({ title: '', target_link: '', image_url: '', is_active: false })
            setPreviewImage(null)
            fetchCampaigns()
        } catch (error: any) {
            console.error('Kaydetme hatası (DETAYLI):', {
                error,
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint
            })
            const errorMessage = error.message || 'Bilinmeyen bir hata oluştu'
            setMessage({ type: 'error', text: `Hata: ${errorMessage}` })
        }
    }

    // Düzenle
    const handleEdit = (campaign: any) => {
        setForm({
            title: campaign.title,
            target_link: campaign.target_link,
            image_url: campaign.image_url,
            is_active: campaign.is_active
        })
        setPreviewImage(campaign.image_url)
        setEditingId(campaign.id)
        setIsModalOpen(true)
    }

    // Sil
    const handleDelete = async (id: string) => {
        if (!confirm('Bu kampanyayı silmek istediğinize emin misiniz?')) return

        try {
            // Önce resmi storage'dan sil
            const campaign = campaigns.find(c => c.id === id)
            if (campaign?.image_url) {
                const urlParts = campaign.image_url.split('/')
                const fileName = urlParts[urlParts.length - 1]
                const filePath = `campaigns/${fileName}`

                await supabase.storage
                    .from('campaigns')
                    .remove([filePath])
            }

            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id)

            if (error) throw error
            setMessage({ type: 'success', text: 'Kampanya silindi!' })
            fetchCampaigns()
        } catch (error: any) {
            console.error('Silme hatası:', error)
            setMessage({ type: 'error', text: 'Hata: ' + error.message })
        }
    }

    // Aktif yap
    const handleSetActive = async (id: string) => {
        try {
            // Önce tümünü pasif yap
            const { error: updateAll } = await supabase
                .from('announcements')
                .update({ is_active: false })
                .neq('id', id)

            if (updateAll) throw updateAll

            // Sonra seçileni aktif yap
            const { error } = await supabase
                .from('announcements')
                .update({ is_active: true })
                .eq('id', id)

            if (error) throw error
            setMessage({ type: 'success', text: 'Kampanya aktif yapıldı!' })
            fetchCampaigns()
        } catch (error: any) {
            console.error('Aktif yapma hatası:', error)
            setMessage({ type: 'error', text: 'Hata: ' + error.message })
        }
    }

    if (loading) {
        return (
            <div className="p-10 text-center text-slate-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="mt-4">Yükleniyor...</p>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200">
            {/* BAŞLIK */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
                    <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                        <ImageIcon size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Global Duyuru Sistemi</h1>
                        <p className="text-slate-400 text-sm">Mobil uygulamada görünecek kampanyaları yönetin</p>
                    </div>
                </div>
                <button
                    onClick={() => {
                        setIsModalOpen(true)
                        setEditingId(null)
                        setForm({ title: '', target_link: '', image_url: '', is_active: false })
                        setPreviewImage(null)
                    }}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"
                >
                    <Upload size={20} />
                    Yeni Kampanya Ekle
                </button>
            </div>

            {/* MESAJ */}
            {message && (
                <div className={`p-4 rounded-xl border ${
                    message.type === 'success' 
                        ? 'bg-green-900/20 border-green-700 text-green-300' 
                        : 'bg-red-900/20 border-red-700 text-red-300'
                } flex items-start gap-3`}>
                    <AlertCircle size={20} className="mt-0.5" />
                    <div className="flex-1">
                        <p className="font-medium">{message.text}</p>
                    </div>
                    <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* KAMPANYA LİSTESİ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {campaigns.map((campaign) => (
                    <div
                        key={campaign.id}
                        className={`bg-slate-900 rounded-xl border overflow-hidden ${
                            campaign.is_active 
                                ? 'border-yellow-500 shadow-lg shadow-yellow-500/20' 
                                : 'border-slate-800'
                        }`}
                    >
                        {/* RESİM */}
                        <div className="relative h-48 bg-slate-800">
                            {campaign.image_url ? (
                                <img
                                    src={campaign.image_url}
                                    alt={campaign.title}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-600">
                                    <ImageIcon size={48} />
                                </div>
                            )}
                            {campaign.is_active && (
                                <div className="absolute top-2 right-2 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                                    <Check size={14} />
                                    AKTİF
                                </div>
                            )}
                        </div>

                        {/* İÇERİK */}
                        <div className="p-4 space-y-3">
                            <h3 className="font-bold text-white text-lg">{campaign.title}</h3>
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <LinkIcon size={14} />
                                <a
                                    href={campaign.target_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:text-yellow-400 truncate"
                                >
                                    {campaign.target_link}
                                </a>
                            </div>
                            <div className="text-xs text-slate-500">
                                {new Date(campaign.created_at).toLocaleDateString('tr-TR')}
                            </div>

                            {/* BUTONLAR */}
                            <div className="flex gap-2 pt-2 border-t border-slate-800">
                                {!campaign.is_active && (
                                    <button
                                        onClick={() => handleSetActive(campaign.id)}
                                        className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black px-3 py-2 rounded-lg text-sm font-bold transition-colors"
                                    >
                                        Aktif Yap
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEdit(campaign)}
                                    className="flex-1 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                >
                                    <Edit2 size={14} />
                                    Düzenle
                                </button>
                                <button
                                    onClick={() => handleDelete(campaign.id)}
                                    className="bg-red-500 hover:bg-red-400 text-white px-3 py-2 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-1"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {campaigns.length === 0 && (
                <div className="text-center py-20 text-slate-500">
                    <ImageIcon size={64} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Henüz kampanya eklenmemiş</p>
                    <p className="text-sm mt-2">Yeni kampanya eklemek için yukarıdaki butona tıklayın</p>
                </div>
            )}

            {/* MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 rounded-xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 space-y-6">
                            {/* BAŞLIK */}
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-white">
                                    {editingId ? 'Kampanya Düzenle' : 'Yeni Kampanya Ekle'}
                                </h2>
                                <button
                                    onClick={() => {
                                        setIsModalOpen(false)
                                        setEditingId(null)
                                        setForm({ title: '', target_link: '', image_url: '', is_active: false })
                                        setPreviewImage(null)
                                    }}
                                    className="text-slate-400 hover:text-white"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* FORM */}
                            <div className="space-y-4">
                                {/* BAŞLIK */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Kampanya Başlığı *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder="Örn: Büyük Ödüllü Bilgi Yarışması"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>

                                {/* LİNK */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Hedef Link (URL) *
                                    </label>
                                    <input
                                        type="url"
                                        value={form.target_link}
                                        onChange={(e) => setForm({ ...form, target_link: e.target.value })}
                                        placeholder="https://example.com/yarisma"
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>

                                {/* RESİM YÜKLEME */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Kampanya Görseli *
                                    </label>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {uploading ? (
                                            <>
                                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                                <span>Yükleniyor...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={20} />
                                                <span>Resim Yükle (Max 5MB)</span>
                                            </>
                                        )}
                                    </button>
                                    {previewImage && (
                                        <div className="mt-4 relative">
                                            <img
                                                src={previewImage}
                                                alt="Preview"
                                                className="w-full h-48 object-cover rounded-lg border border-slate-700"
                                            />
                                            <button
                                                onClick={() => {
                                                    setPreviewImage(null)
                                                    setForm({ ...form, image_url: '' })
                                                }}
                                                className="absolute top-2 right-2 bg-red-500 hover:bg-red-400 text-white p-2 rounded-full"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                    {form.image_url && !previewImage && (
                                        <div className="mt-4 relative">
                                            <img
                                                src={form.image_url}
                                                alt="Current"
                                                className="w-full h-48 object-cover rounded-lg border border-slate-700"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* AKTİF Mİ */}
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="is_active"
                                        checked={form.is_active}
                                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-yellow-500 focus:ring-2 focus:ring-yellow-500"
                                    />
                                    <label htmlFor="is_active" className="text-sm text-slate-300">
                                        Bu kampanyayı aktif yap (Mobilde görünsün)
                                    </label>
                                </div>
                            </div>

                            {/* BUTONLAR */}
                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <button
                                    onClick={() => {
                                        setIsModalOpen(false)
                                        setEditingId(null)
                                        setForm({ title: '', target_link: '', image_url: '', is_active: false })
                                        setPreviewImage(null)
                                    }}
                                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold transition-colors"
                                >
                                    {editingId ? 'Güncelle' : 'Kaydet'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

