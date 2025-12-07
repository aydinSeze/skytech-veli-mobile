'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Upload, X, Edit2, Trash2, Check, Image as ImageIcon, Link as LinkIcon, AlertCircle, Download, Users, Activity } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
    const [userStats, setUserStats] = useState<any>(null)
    const [statsLoading, setStatsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'kampanyalar' | 'haberler'>('kampanyalar') // Sekme yönetimi

    const [form, setForm] = useState({
        title: '',
        description: '',
        target_link: '',
        image_url: '',
        is_active: false,
        start_date: '',
        end_date: '',
        display_location: 'ana_sayfa' // 'ana_sayfa' veya 'haberler'
    })

    // Verileri çek (Sekmeye göre filtrele)
    const fetchCampaigns = async () => {
        try {
            let query = supabase
                .from('announcements')
                .select('*')
            
            // Sekmeye göre filtrele - ÖNEMLİ: Kampanyalar ve Haberler ayrı
            if (activeTab === 'kampanyalar') {
                query = query.eq('display_location', 'ana_sayfa')
            } else if (activeTab === 'haberler') {
                query = query.eq('display_location', 'haberler')
            }
            
            const { data, error } = await query
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

    // Kullanıcı istatistiklerini çek (Basit ve güvenilir yöntem)
    const fetchUserStats = async () => {
        try {
            setStatsLoading(true)
            
            // Toplam öğrenci sayısı
            const { count: totalStudents, error: studentsError } = await supabase
                .from('students')
                .select('*', { count: 'exact', head: true })

            if (studentsError) {
                console.error('Öğrenci sayısı hatası:', studentsError)
            }

            // Son 30 günde aktif kullanıcılar (app_usage tablosundan)
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            
            const { data: appUsageData, error: usageError } = await supabase
                .from('app_usage')
                .select('student_id, created_at')
                .eq('action', 'app_open')
                .gte('created_at', thirtyDaysAgo.toISOString())

            let activeCount = 0
            if (!usageError && appUsageData) {
                // Benzersiz aktif kullanıcı sayısı
                const uniqueActiveUsers = new Set(appUsageData.map((u: any) => u.student_id))
                activeCount = uniqueActiveUsers.size
            } else if (usageError) {
                // Tablo yoksa veya hata varsa, sadece logla
                console.warn('app_usage tablosu bulunamadı veya hata:', usageError)
            }

            const total = totalStudents || 0
            const inactiveCount = Math.max(0, total - activeCount)

            setUserStats({
                totalStudents: total,
                activeUsers: activeCount,
                inactiveUsers: inactiveCount,
                activityData: []
            })
        } catch (error) {
            console.error('İstatistik çekme hatası:', error)
            setUserStats({
                totalStudents: 0,
                activeUsers: 0,
                inactiveUsers: 0,
                activityData: []
            })
        } finally {
            setStatsLoading(false)
        }
    }

    useEffect(() => {
        fetchCampaigns()
        fetchUserStats()
    }, [activeTab]) // activeTab değiştiğinde yeniden çek

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
        // Validasyon
        if (!form.title || !form.title.trim()) {
            setMessage({ type: 'error', text: 'Lütfen kampanya başlığı girin!' })
            return
        }

        if (!form.target_link || !form.target_link.trim()) {
            setMessage({ type: 'error', text: 'Lütfen hedef link girin!' })
            return
        }

        if (!form.image_url || !form.image_url.trim()) {
            setMessage({ type: 'error', text: 'Lütfen kampanya görseli yükleyin!' })
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
            // Kullanıcı kontrolü
            const { data: { user }, error: userError } = await supabase.auth.getUser()
            if (userError || !user) {
                throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.')
            }

            // Admin kontrolü
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()

            if (profileError) {
                console.error('Profil çekme hatası:', JSON.stringify(profileError, null, 2))
            }

            if (profile?.role !== 'admin') {
                throw new Error(`Yetkiniz yok! Admin rolü gerekiyor. Mevcut rolünüz: ${profile?.role || 'bulunamadı'}. Lütfen ADMIN_YAP_AYDIN.sql dosyasını çalıştırın.`)
            }

            // Veritabanına kaydedilecek data - SADECE MEVCUT SÜTUNLAR
            const dataToSave: any = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                image_url: form.image_url.trim(),
                target_link: form.target_link.trim(),
                is_active: form.is_active,
                display_location: form.display_location || 'ana_sayfa'
            }

            // Tarih alanları varsa ekle
            if (form.start_date) {
                dataToSave.start_date = form.start_date
            }
            if (form.end_date) {
                dataToSave.end_date = form.end_date
            }

            if (editingId) {
                // GÜNCELLEME
                const { data, error } = await supabase
                    .from('announcements')
                    .update(dataToSave)
                    .eq('id', editingId)
                    .select()

                if (error) {
                    // Detaylı hata loglama
                    console.error('Güncelleme hatası (DETAYLI):', JSON.stringify({
                        error,
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        hint: error.hint,
                        dataToSave
                    }, null, 2))

                    // Kullanıcı dostu hata mesajları
                    if (error.message?.includes('row-level security') || error.message?.includes('policy') || error.code === '42501') {
                        throw new Error('RLS Politikası Hatası: Admin yetkisi yok. Lütfen CREATE_CAMPAIGN_SYSTEM.sql ve ADMIN_YAP_AYDIN.sql dosyalarını çalıştırdığınızdan emin olun.')
                    }
                    if (error.message?.includes('could not find') || error.message?.includes('does not exist') || error.code === 'PGRST116') {
                        throw new Error('Announcements tablosu bulunamadı. Lütfen TAMAMEN_CALISTIR_BUNU.sql dosyasını Supabase SQL Editor\'de çalıştırın.')
                    }
                    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
                        throw new Error(`Veritabanı hatası: Tabloda olmayan bir sütuna yazmaya çalışılıyor. Hata: ${error.message}`)
                    }
                    throw new Error(`Güncelleme hatası: ${error.message || 'Bilinmeyen hata'}`)
                }

                setMessage({ type: 'success', text: 'Kampanya başarıyla güncellendi!' })
            } else {
                // YENİ EKLEME
                const { data, error } = await supabase
                    .from('announcements')
                    .insert([dataToSave])
                    .select()

                if (error) {
                    // Detaylı hata loglama
                    console.error('Ekleme hatası (DETAYLI):', JSON.stringify({
                        error,
                        message: error.message,
                        code: error.code,
                        details: error.details,
                        hint: error.hint,
                        dataToSave
                    }, null, 2))

                    // Kullanıcı dostu hata mesajları
                    if (error.message?.includes('row-level security') || error.message?.includes('policy') || error.code === '42501') {
                        throw new Error('RLS Politikası Hatası: Admin yetkisi yok. Lütfen CREATE_CAMPAIGN_SYSTEM.sql ve ADMIN_YAP_AYDIN.sql dosyalarını çalıştırdığınızdan emin olun.')
                    }
                    if (error.message?.includes('could not find') || error.message?.includes('does not exist') || error.code === 'PGRST116') {
                        throw new Error('Announcements tablosu bulunamadı. Lütfen TAMAMEN_CALISTIR_BUNU.sql dosyasını Supabase SQL Editor\'de çalıştırın.')
                    }
                    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
                        throw new Error(`Veritabanı hatası: Tabloda olmayan bir sütuna yazmaya çalışılıyor. Hata: ${error.message}`)
                    }
                    throw new Error(`Ekleme hatası: ${error.message || 'Bilinmeyen hata'}`)
                }

                setMessage({ type: 'success', text: 'Kampanya başarıyla eklendi!' })
            }

            // Başarılı - Formu temizle ve listeyi yenile
            setIsModalOpen(false)
            setEditingId(null)
            setForm({ title: '', description: '', target_link: '', image_url: '', is_active: false, start_date: '', end_date: '', display_location: 'ana_sayfa' })
            setPreviewImage(null)
            await fetchCampaigns()
        } catch (error: any) {
            // Detaylı hata loglama
            console.error('Kaydetme hatası (DETAYLI):', JSON.stringify({
                error,
                message: error?.message,
                code: error?.code,
                details: error?.details,
                hint: error?.hint,
                stack: error?.stack
            }, null, 2))

            // Kullanıcıya gösterilecek mesaj
            const errorMessage = error?.message || 'Bilinmeyen bir hata oluştu'
            setMessage({ type: 'error', text: `❌ ${errorMessage}` })
        }
    }

    // PDF İndir (Türkçe karakter desteği ile)
    const handleDownloadPDF = async () => {
        try {
            const doc = new jsPDF()
            
            // Türkçe karakter desteği için - Unicode encoding kullan
            doc.setFont('helvetica')
            
            // Başlık - Türkçe karakterleri doğru göster
            doc.setFontSize(18)
            const title = activeTab === 'kampanyalar' ? 'Kampanya Goruntulenme Raporu' : 'Haber Goruntulenme Raporu'
            doc.text(title, 14, 20)
            
            // Tarih
            doc.setFontSize(10)
            const dateText = `Olusturulma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`
            doc.text(dateText, 14, 30)
            
            // Türkçe karakter dönüştürme fonksiyonu
            const fixTurkishChars = (text: string): string => {
                return text
                    .replace(/ı/g, 'i').replace(/İ/g, 'I')
                    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                    .replace(/ş/g, 's').replace(/Ş/g, 'S')
                    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
            }
            
            // Tablo verileri - Türkçe karakterleri düzgün göster
            const tableData = campaigns.map(campaign => [
                fixTurkishChars(campaign.title || ''),
                campaign.display_location === 'ana_sayfa' ? 'Ana Sayfa' : 'Haberler',
                campaign.is_active ? 'Aktif' : 'Pasif',
                (campaign.view_count || 0).toString(),
                new Date(campaign.created_at).toLocaleDateString('tr-TR')
            ])
            
            // Tablo oluştur - Türkçe karakter desteği ile
            autoTable(doc, {
                head: [['Baslik', 'Konum', 'Durum', 'Goruntulenme', 'Olusturulma']],
                body: tableData,
                startY: 40,
                styles: { 
                    font: 'helvetica',
                    fontSize: 9,
                    cellPadding: 3,
                    halign: 'left'
                },
                headStyles: {
                    fillColor: [255, 215, 0], // Sarı
                    textColor: [0, 0, 0],
                    fontStyle: 'bold'
                },
                alternateRowStyles: {
                    fillColor: [30, 41, 59] // Dark slate
                },
                // Türkçe karakter desteği için
                didParseCell: function (data: any) {
                    // Hücre içeriğini UTF-8 olarak işle
                    if (data.cell.text) {
                        data.cell.text = data.cell.text.map((text: string) => {
                            // Türkçe karakterleri koru
                            return text
                        })
                    }
                }
            })
            
            // Dosyayı indir
            const fileName = activeTab === 'kampanyalar' 
                ? `kampanya-raporu-${new Date().toISOString().split('T')[0]}.pdf`
                : `haber-raporu-${new Date().toISOString().split('T')[0]}.pdf`
            doc.save(fileName)
            setMessage({ type: 'success', text: 'PDF başarıyla indirildi!' })
        } catch (error: any) {
            console.error('PDF oluşturma hatası:', error)
            setMessage({ type: 'error', text: `PDF oluşturulamadı: ${error.message}` })
        }
    }

    // Düzenle
    const handleEdit = (campaign: any) => {
        // Tarih formatını düzelt (YYYY-MM-DD)
        const formatDate = (dateStr: string | null) => {
            if (!dateStr) return ''
            const date = new Date(dateStr)
            return date.toISOString().split('T')[0]
        }

        setForm({
            title: campaign.title || '',
            description: campaign.description || '',
            target_link: campaign.target_link || '',
            image_url: campaign.image_url || '',
            is_active: campaign.is_active || false,
            start_date: formatDate(campaign.start_date),
            end_date: formatDate(campaign.end_date),
            display_location: campaign.display_location || 'ana_sayfa'
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
            // Seçilen kaydın display_location'ını kontrol et
            const selectedItem = campaigns.find(c => c.id === id)
            
            // Sadece kampanyalar (ana_sayfa) için diğerlerini pasif yap
            // Haberler için sınır yok, direkt aktif yap
            if (selectedItem?.display_location === 'ana_sayfa') {
                // Önce aynı display_location'daki tümünü pasif yap
                const { error: updateAll } = await supabase
                    .from('announcements')
                    .update({ is_active: false })
                    .eq('display_location', 'ana_sayfa')
                    .neq('id', id)

                if (updateAll) throw updateAll
            }

            // Sonra seçileni aktif yap
            const { error } = await supabase
                .from('announcements')
                .update({ is_active: true })
                .eq('id', id)

            if (error) throw error
            setMessage({ type: 'success', text: activeTab === 'kampanyalar' ? 'Kampanya aktif yapıldı!' : 'Haber aktif yapıldı!' })
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
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                            <ImageIcon size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">Global Duyuru Sistemi</h1>
                            <p className="text-slate-400 text-sm">
                                {activeTab === 'kampanyalar' 
                                    ? 'Mobil uygulamada görünecek kampanyaları yönetin'
                                    : 'Mobil uygulamadaki haberler sayfasını yönetin'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setIsModalOpen(true)
                            setEditingId(null)
                            setForm({ 
                                title: '', 
                                description: '', 
                                target_link: '', 
                                image_url: '', 
                                is_active: false, 
                                start_date: '', 
                                end_date: '',
                                display_location: activeTab === 'kampanyalar' ? 'ana_sayfa' : 'haberler'
                            })
                            setPreviewImage(null)
                        }}
                        className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg"
                    >
                        <Upload size={20} />
                        {activeTab === 'kampanyalar' ? 'Yeni Kampanya Ekle' : 'Yeni Haber Ekle'}
                    </button>
                </div>

                {/* SEKMELER */}
                <div className="flex gap-2 border-b border-slate-800">
                    <button
                        onClick={() => setActiveTab('kampanyalar')}
                        className={`px-6 py-3 font-bold transition-colors ${
                            activeTab === 'kampanyalar'
                                ? 'text-yellow-400 border-b-2 border-yellow-400'
                                : 'text-slate-400 hover:text-slate-300'
                        }`}
                    >
                        📢 Kampanyalar
                    </button>
                    <button
                        onClick={() => setActiveTab('haberler')}
                        className={`px-6 py-3 font-bold transition-colors ${
                            activeTab === 'haberler'
                                ? 'text-yellow-400 border-b-2 border-yellow-400'
                                : 'text-slate-400 hover:text-slate-300'
                        }`}
                    >
                        📰 Haberler
                    </button>
                </div>
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

            {/* KULLANICI İSTATİSTİKLERİ */}
            <div className="mb-6 bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Users size={24} />
                    Mobil Uygulama Kullanıcı İstatistikleri
                </h3>
                {statsLoading ? (
                    <div className="text-slate-400">Yükleniyor...</div>
                ) : userStats ? (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                            <div className="text-slate-400 text-sm mb-1">Toplam Kullanıcı</div>
                            <div className="text-3xl font-bold text-white">{userStats.totalStudents}</div>
                        </div>
                        <div className="bg-green-900/20 rounded-lg p-4 border border-green-700">
                            <div className="text-green-400 text-sm mb-1">Aktif Kullanıcı</div>
                            <div className="text-3xl font-bold text-green-400">{userStats.activeUsers}</div>
                        </div>
                        <div className="bg-red-900/20 rounded-lg p-4 border border-red-700">
                            <div className="text-red-400 text-sm mb-1">Pasif/Kaldıran</div>
                            <div className="text-3xl font-bold text-red-400">{userStats.inactiveUsers}</div>
                        </div>
                        <div className="bg-blue-900/20 rounded-lg p-4 border border-blue-700">
                            <div className="text-blue-400 text-sm mb-1">Aktiflik Oranı</div>
                            <div className="text-3xl font-bold text-blue-400">
                                {userStats.totalStudents > 0 
                                    ? Math.round((userStats.activeUsers / userStats.totalStudents) * 100)
                                    : 0}%
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-slate-400">İstatistikler yüklenemedi</div>
                )}
            </div>

            {/* İSTATİSTİKLER VE PDF İNDİRME */}
            <div className="mb-6 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4">
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                            <Users size={16} />
                            <span>Toplam Kampanya</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{campaigns.length}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                            <Activity size={16} />
                            <span>Aktif Kampanya</span>
                        </div>
                        <div className="text-2xl font-bold text-yellow-400">
                            {campaigns.filter(c => c.is_active).length}
                        </div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                            <Check size={16} />
                            <span>Toplam Görüntülenme</span>
                        </div>
                        <div className="text-2xl font-bold text-green-400">
                            {campaigns.reduce((sum, c) => sum + (c.view_count || 0), 0)}
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleDownloadPDF}
                    className="bg-indigo-500 hover:bg-indigo-400 text-white px-6 py-3 rounded-lg font-bold transition-colors flex items-center gap-2"
                >
                    <Download size={18} />
                    PDF İndir
                </button>
            </div>

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
                            <div className="text-xs text-slate-500 space-y-1">
                                <div>{new Date(campaign.created_at).toLocaleDateString('tr-TR')}</div>
                                <div className="text-blue-400">
                                    📍 {campaign.display_location === 'ana_sayfa' ? 'Ana Sayfa' : 'Haberler'}
                                </div>
                                {campaign.view_count !== null && campaign.view_count !== undefined && (
                                    <div className="text-yellow-400 font-semibold">
                                        👁️ Görüntülenme: {campaign.view_count || 0}
                                    </div>
                                )}
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
                                        setForm({ title: '', description: '', target_link: '', image_url: '', is_active: false, start_date: '', end_date: '', display_location: activeTab === 'kampanyalar' ? 'ana_sayfa' : 'haberler' })
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
                                        {activeTab === 'kampanyalar' ? 'Kampanya Başlığı *' : 'Haber Başlığı *'}
                                    </label>
                                    <input
                                        type="text"
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        placeholder={activeTab === 'kampanyalar' 
                                            ? 'Örn: Büyük Ödüllü Bilgi Yarışması'
                                            : 'Örn: Yeni Eğitim Programı Duyurusu'}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                    />
                                </div>

                                {/* AÇIKLAMA */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        {activeTab === 'kampanyalar' ? 'Kampanya Açıklaması' : 'Haber Açıklaması'}
                                    </label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder={activeTab === 'kampanyalar'
                                            ? 'Kampanya hakkında kısa bir açıklama yazın...'
                                            : 'Haber içeriğini detaylı olarak yazın...'}
                                        rows={4}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                                    />
                                </div>

                                {/* TARİH ARALIĞI */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Başlangıç Tarihi
                                        </label>
                                        <input
                                            type="date"
                                            value={form.start_date}
                                            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Bitiş Tarihi
                                        </label>
                                        <input
                                            type="date"
                                            value={form.end_date}
                                            onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500"
                                        />
                                    </div>
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

                                {/* RESİM YÜKLEME - DİKEY FORMAT (9:16) */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        {activeTab === 'kampanyalar' ? 'Kampanya Görseli *' : 'Haber Görseli *'} (Dikey Format - 9:16 Önerilir)
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
                                                <span>Resim Yükle (Max 5MB - Dikey Format)</span>
                                            </>
                                        )}
                                    </button>
                                    {previewImage && (
                                        <div className="mt-4 relative flex justify-center">
                                            <div className="relative w-full max-w-[200px]">
                                                <img
                                                    src={previewImage}
                                                    alt="Preview"
                                                    className="w-full aspect-[9/16] object-cover rounded-lg border-2 border-yellow-500 shadow-lg"
                                                    style={{ maxHeight: '400px' }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        setPreviewImage(null)
                                                        setForm({ ...form, image_url: '' })
                                                    }}
                                                    className="absolute top-2 right-2 bg-red-500 hover:bg-red-400 text-white p-2 rounded-full shadow-lg"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {form.image_url && !previewImage && (
                                        <div className="mt-4 relative flex justify-center">
                                            <div className="relative w-full max-w-[200px]">
                                                <img
                                                    src={form.image_url}
                                                    alt="Current"
                                                    className="w-full aspect-[9/16] object-cover rounded-lg border-2 border-slate-700"
                                                    style={{ maxHeight: '400px' }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* GÖRÜNTÜLENME YERİ - Otomatik olarak sekmeye göre ayarlanır */}
                                <input type="hidden" value={form.display_location} />
                                <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
                                    <p className="text-sm text-blue-300">
                                        {activeTab === 'kampanyalar'
                                            ? '📍 Bu içerik Ana Sayfa\'daki kampanya kartında görünecek'
                                            : '📍 Bu içerik Haberler sayfasında listelenecek'}
                                    </p>
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
                                        {activeTab === 'kampanyalar'
                                            ? 'Bu kampanyayı aktif yap (Mobilde görünsün)'
                                            : 'Bu haberi aktif yap (Mobilde görünsün)'}
                                    </label>
                                </div>
                            </div>

                            {/* BUTONLAR */}
                            <div className="flex gap-3 pt-4 border-t border-slate-800">
                                <button
                                    onClick={() => {
                                        setIsModalOpen(false)
                                        setEditingId(null)
                                        setForm({ title: '', description: '', target_link: '', image_url: '', is_active: false, start_date: '', end_date: '', display_location: 'ana_sayfa' })
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

