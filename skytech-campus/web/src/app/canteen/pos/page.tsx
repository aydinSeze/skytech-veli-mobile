'use client'

import { createClient } from '@/utils/supabase/client'
import { useRef, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import confetti from 'canvas-confetti'
import { refundTransaction, processPayment } from '@/actions/pos-actions'
import { RefreshCcw, Minus, Plus, Trash2, History, ScanBarcode, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function POSPage() {
    const supabase = createClient()
    const searchParams = useSearchParams()
    const [products, setProducts] = useState<any[]>([])
    const [canteens, setCanteens] = useState<any[]>([])
    const [selectedCanteen, setSelectedCanteen] = useState<string>('')
    const [cart, setCart] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [userSchoolId, setUserSchoolId] = useState<string | null>(null)
    const [systemCredit, setSystemCredit] = useState<number>(0)
    const [isAdmin, setIsAdmin] = useState(false)

    // Arama ve Barkod
    const [searchQuery, setSearchQuery] = useState('')
    const barcodeInputRef = useRef<HTMLInputElement>(null)

    // Ödeme Modalı State'leri
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [cardId, setCardId] = useState('')
    const [processing, setProcessing] = useState(false)
    const cardInputRef = useRef<HTMLInputElement>(null)

    // İade Modalı
    const [isRefundModalOpen, setIsRefundModalOpen] = useState(false)
    const [recentTransactions, setRecentTransactions] = useState<any[]>([])

    // 1. Okul ID ve Kantinleri Çek
    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null

        const fetchInitialData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    console.error('Kullanıcı bulunamadı')
                    return
                }

                // Yönetici kontrolü
                const isAdminEmail = user.email === 'admin@skytech.com' || user.email?.includes('admin')
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('school_id, role')
                    .eq('id', user.id)
                    .single()

                const userRole = profile?.role || (isAdminEmail ? 'admin' : null)
                setIsAdmin(userRole === 'admin' || userRole === 'school_admin')

                // Yönetici ise URL'den schoolId al, değilse profile'dan al
                let targetSchoolId: string | null = null
                
                if (isAdmin || userRole === 'admin' || userRole === 'school_admin') {
                    // Yönetici için URL parametresinden schoolId al
                    const urlSchoolId = searchParams.get('schoolId')
                    if (urlSchoolId) {
                        targetSchoolId = urlSchoolId
                    } else if (profile?.school_id) {
                        targetSchoolId = profile.school_id
                    } else {
                        console.error('Yönetici için schoolId bulunamadı (URL parametresi veya profil)')
                        alert('Okul bilgisi bulunamadı! Lütfen okul detay sayfasından tekrar deneyin.')
                        return
                    }
                } else {
                    // Normal kullanıcı için profile'dan al
                    if (profileError || !profile?.school_id) {
                        console.error('Okul bilgisi bulunamadı:', profileError)
                        alert('Okul bilgisi bulunamadı! Lütfen sayfayı yenileyin.')
                        return
                    }
                    targetSchoolId = profile.school_id
                }

                setUserSchoolId(targetSchoolId)

                // Sistem kredisini çek
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('system_credit')
                    .eq('id', targetSchoolId)
                    .single()
                
                if (schoolData) {
                    setSystemCredit(schoolData.system_credit || 0)
                }

                // Realtime abonelik - Sistem kredisi güncellemelerini dinle
                channel = supabase
                    .channel('system-credit-updates-pos')
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'schools',
                            filter: `id=eq.${targetSchoolId}`
                        },
                        (payload) => {
                            if (payload.new && 'system_credit' in payload.new) {
                                setSystemCredit(payload.new.system_credit as number)
                            }
                        }
                    )
                    .subscribe()

                // Kantinleri çek (Sadece işlem kaydı için gerekli, ürün filtresi için değil)
                const { data: canteenData, error: canteenError } = await supabase
                    .from('canteens')
                    .select('*')
                    .eq('school_id', targetSchoolId)

                if (canteenError) {
                    console.error('Kantin bilgisi çekilirken hata:', canteenError)
                } else if (canteenData && canteenData.length > 0) {
                    setCanteens(canteenData)
                    setSelectedCanteen(canteenData[0].id)
                }
            } catch (error) {
                console.error('İlk veri çekme hatası:', error)
            }
        }
        
        fetchInitialData()

        // Cleanup function
        return () => {
            if (channel) {
                supabase.removeChannel(channel)
            }
        }
    }, [supabase, searchParams])

    // 2. Ürünleri Çek (Sadece Okul ID'ye göre)
    useEffect(() => {
        if (!userSchoolId) {
            setLoading(false)
            return
        }
        const fetchProducts = async () => {
            try {
                setLoading(true)
                const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .eq('school_id', userSchoolId) // Sadece okul filtresi
                    .order('name')

                if (error) {
                    console.error('Ürün çekme hatası:', error)
                    alert('Ürünler yüklenirken hata oluştu. Lütfen sayfayı yenileyin.')
                } else {
                    setProducts(data || [])
                    console.log(`${data?.length || 0} ürün yüklendi`)
                }
            } catch (error) {
                console.error('Ürün yükleme hatası:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchProducts()
    }, [userSchoolId, supabase]) // selectedCanteen bağımlılığı kaldırıldı

    // Modal açılınca inputa odaklan
    useEffect(() => {
        if (isPaymentModalOpen && cardInputRef.current) {
            cardInputRef.current.focus()
        } else if (!isPaymentModalOpen && !isRefundModalOpen && barcodeInputRef.current) {
            // Modal kapandığında ana inputa odaklan
            barcodeInputRef.current.focus()
        }
    }, [isPaymentModalOpen, isRefundModalOpen])

    // Sayfa yüklenince odaklan
    useEffect(() => {
        if (!loading && barcodeInputRef.current) {
            barcodeInputRef.current.focus()
        }
    }, [loading])

    // Sepete Ekle
    const addToCart = (product: any) => {
        const existing = cart.find(item => item.id === product.id)
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        } else {
            setCart([...cart, { ...product, quantity: 1 }])
        }
        // Ekleme sonrası odaklan
        setTimeout(() => barcodeInputRef.current?.focus(), 100)
    }

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.id !== productId))
        setTimeout(() => barcodeInputRef.current?.focus(), 100)
    }

    // Miktar Güncelleme (Bulk Input) - Stok kontrolü kaldırıldı, eksiye düşebilir
    const updateQuantity = (productId: string, newQuantity: number) => {
        if (isNaN(newQuantity) || newQuantity < 1) return

        const product = products.find(p => p.id === productId)
        if (!product) return

        // Stok kontrolü kaldırıldı - Eksiye düşebilir
        setCart(cart.map(item => item.id === productId ? { ...item, quantity: newQuantity } : item))
    }

    const cartTotal = cart.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0)

    // --- REKOR HESAPLAMA ---
    const checkRecord = async (currentSaleAmount: number) => {
        if (!selectedCanteen) return false
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        const { data: yesterdayData } = await supabase.from('transactions')
            .select('amount').eq('canteen_id', selectedCanteen)
            .gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString())
        const yesterdayTotal = yesterdayData?.reduce((sum, t) => sum + t.amount, 0) || 0

        const { data: todayData } = await supabase.from('transactions')
            .select('amount').eq('canteen_id', selectedCanteen).gte('created_at', today.toISOString())
        const currentTodayTotal = todayData?.reduce((sum, t) => sum + t.amount, 0) || 0

        const newTodayTotal = currentTodayTotal + currentSaleAmount
        if (newTodayTotal > yesterdayTotal && currentTodayTotal <= yesterdayTotal) {
            return { isRecord: true, yesterdayTotal, newTodayTotal }
        }
        return { isRecord: false, yesterdayTotal, newTodayTotal }
    }

    // --- ÖDEME İŞLEMİ ---
    const handlePayment = async () => {
        if (!cardId) return
        
        if (!userSchoolId) {
            alert('Okul bilgisi bulunamadı! Lütfen sayfayı yenileyin.')
            return
        }

        // Sistem kredisi kontrolü - Düşük kredi uyarısı
        if (systemCredit < 100) {
            const confirmContinue = confirm(
                `⚠️ UYARI: Sistem krediniz düşük (₺${systemCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}). ` +
                `Satış yapmaya devam etmek istiyor musunuz? ` +
                `Sisteminizin kapanmaması için lütfen sistem kurucusundan kredi satın alınız.`
            )
            if (!confirmContinue) {
                return
            }
        }

        setProcessing(true)

        try {
            // Server Action Çağır (Güvenli İşlem)
            const result = await processPayment(cardId, cart, userSchoolId, selectedCanteen)

            if (result.success) {
                // Rekor Kontrolü (Client tarafında sadece görsel efekt için)
                const recordResult = await checkRecord(result.totalAmount || 0)

                if (recordResult && recordResult.isRecord) {
                    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
                    alert(`🚀 REKOR KIRILDI! TEBRİKLER!\n\nBugünkü Ciro (₺${recordResult.newTodayTotal}), Dünü (₺${recordResult.yesterdayTotal}) geçti!`)
                } else {
                    alert(`✅ ${result.message}\nKalan Bakiye: ₺${result.newBalance?.toFixed(2)}`)
                }

                setCart([])
                setIsPaymentModalOpen(false)
                setCardId('')

                // Ürünleri güncelle
                if (userSchoolId) {
                    const { data } = await supabase.from('products').select('*').eq('school_id', userSchoolId).order('name')
                    setProducts(data || [])
                }
            } else {
                alert('❌ ' + result.error)
            }

        } catch (error: any) {
            alert('Hata: ' + error.message)
        } finally {
            setProcessing(false)
            // İşlem bitince odaklan
            setTimeout(() => barcodeInputRef.current?.focus(), 100)
        }
    }

    // İADE İŞLEMLERİ
    const openRefundModal = async () => {
        setIsRefundModalOpen(true)
        setRecentTransactions([])

        // Son işlemleri çek (Bugün)
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (userSchoolId) {
            const { data } = await supabase
                .from('transactions')
                .select('*, students(full_name), school_personnel(full_name)')
                .eq('school_id', userSchoolId)
                .gte('created_at', today.toISOString())
                .order('created_at', { ascending: false })
                .limit(20)

            setRecentTransactions(data || [])
        }
    }

    const handleRefund = async (transactionId: string) => {
        if (!confirm('Bu işlemi iade etmek istediğinize emin misiniz?')) return

        const result = await refundTransaction(transactionId)
        if (result.success) {
            alert(result.message)
            openRefundModal() // Listeyi yenile
            // Ürünleri de yenilemek gerekebilir stok değiştiği için
            if (userSchoolId) {
                const { data } = await supabase.from('products').select('*').eq('school_id', userSchoolId).order('name')
                setProducts(data || [])
            }
        } else {
            alert('Hata: ' + result.error)
        }
    }

    // Barkod Tarama İşlemi
    const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const term = searchQuery.trim().toLowerCase()
            if (!term) return

            // 1. Tam Eşleşme (Barkod veya İsim)
            const exactMatch = products.find(p =>
                (p.barcode && p.barcode.toLowerCase() === term) ||
                p.name.toLowerCase() === term
            )

            if (exactMatch) {
                addToCart(exactMatch)
                setSearchQuery('')
                return
            }

            // 2. Eğer tam eşleşme yoksa ve sadece 1 tane filtrelenmiş ürün varsa onu ekle
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.barcode && p.barcode.toLowerCase().includes(term))
            )

            if (filtered.length === 1) {
                addToCart(filtered[0])
                setSearchQuery('')
            }
        }
    }

    // Ürün Filtreleme
    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    return (
        <div className="h-[calc(100vh-100px)] flex gap-6 p-4 relative">
            {/* SİSTEM KREDİSİ UYARISI - Yanıp Sönen */}
            {systemCredit < 100 && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-pulse">
                    <div className="bg-red-900/95 border-2 border-red-500 rounded-xl p-4 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="text-3xl animate-pulse">⚠️</div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1">Sistem Kredisi Düşük!</h3>
                                <p className="text-sm text-red-100">
                                    Sistem krediniz <span className="font-bold">₺{systemCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> seviyesine düştü. 
                                    Sisteminizin kapanmaması için lütfen sistem kurucusundan kredi satın alınız.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SOL: ÜRÜNLER */}
            <div className="flex-1 flex flex-col gap-4">
                <div className="bg-slate-800 p-4 rounded-lg flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">🛒 Hızlı Satış</h2>
                        {/* Kantin seçimi sadece işlem kaydı için arka planda tutuluyor, UI'da göstermeye gerek yok veya bilgi amaçlı kalabilir */}
                        {canteens.length > 0 && (
                            <div className="text-slate-400 text-sm mr-4">
                                Kasa: {canteens.find(c => c.id === selectedCanteen)?.name || 'Ana Kantin'}
                            </div>
                        )}
                        <button onClick={openRefundModal} className="bg-orange-600/20 hover:bg-orange-600 text-orange-400 hover:text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors border border-orange-500/30">
                            <History size={18} /> Son İşlemler / İade
                        </button>
                    </div>

                    {/* BARKOD / ARAMA INPUTU */}
                    <div className="relative w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <ScanBarcode className="text-slate-400" size={24} />
                        </div>
                        <input
                            ref={barcodeInputRef}
                            type="text"
                            className="block w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 text-lg font-medium shadow-inner"
                            placeholder="Barkod okutun veya ürün adı yazın..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleBarcodeScan}
                            autoComplete="off"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <Search className="text-slate-500" size={20} />
                        </div>
                    </div>
                </div>
                <div className="flex-1 bg-slate-800/50 rounded-lg p-4 overflow-y-auto">
                    {loading ? (
                        <div className="text-white text-center mt-10">Ürünler Yükleniyor...</div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {filteredProducts.map(product => {
                                const stock = product.stock_quantity || 0
                                
                                // Stok durumuna göre renk belirleme
                                let borderClass = ''
                                let bgClass = ''
                                let animateClass = ''
                                
                                if (stock <= 0) {
                                    // Ekside veya 0: Sert kırmızı, yanıp sönen
                                    borderClass = 'border-red-600'
                                    bgClass = 'bg-red-900/30'
                                    animateClass = 'animate-pulse'
                                } else if (stock <= 1) {
                                    // 1 veya daha az: Sert kırmızı ton, yanıp sönen
                                    borderClass = 'border-red-500'
                                    bgClass = 'bg-red-900/25'
                                    animateClass = 'animate-pulse'
                                } else if (stock <= 10) {
                                    // 2-10 arası: Kırmızı tonları, yanıp sönen
                                    borderClass = 'border-red-400'
                                    bgClass = 'bg-red-900/20'
                                    animateClass = 'animate-pulse'
                                } else if (stock <= 15) {
                                    // 11-15 arası: Kırmızı tonları (daha açık)
                                    borderClass = 'border-orange-500'
                                    bgClass = 'bg-orange-900/15'
                                    animateClass = ''
                                } else if (stock <= 30) {
                                    // 16-30 arası: Sarı çerçeve
                                    borderClass = 'border-yellow-500'
                                    bgClass = 'bg-yellow-900/10'
                                    animateClass = ''
                                } else {
                                    // 30+ : Yeşil çerçeve
                                    borderClass = 'border-green-500'
                                    bgClass = 'bg-green-900/10'
                                    animateClass = ''
                                }
                                
                                return (
                                    <button key={product.id} onClick={() => addToCart(product)}
                                        className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 h-40 border-2 transition-all relative overflow-hidden shadow-lg ${borderClass} ${bgClass} ${animateClass} hover:scale-105`}>

                                        {/* Stok Uyarısı (Arka Plan Yazısı) */}
                                        {stock <= 1 && (
                                            <div className="absolute top-2 right-2 text-red-500 text-xs font-bold bg-red-950 px-2 py-1 rounded animate-pulse">
                                                {stock <= 0 ? 'STOK EKSİ' : 'STOK AZ'}
                                            </div>
                                        )}

                                        <div className="font-bold text-white text-center z-10">{product.name}</div>
                                        <div className="text-green-400 font-bold text-xl z-10">₺{product.selling_price}</div>
                                        <div className={`text-xs z-10 font-bold ${
                                            stock <= 0 ? 'text-red-500' : 
                                            stock <= 1 ? 'text-red-400' : 
                                            stock <= 10 ? 'text-red-300' : 
                                            stock <= 15 ? 'text-orange-400' : 
                                            stock <= 30 ? 'text-yellow-400' : 
                                            'text-green-400'
                                        }`}>
                                            Stok: {stock}
                                        </div>
                                    </button>
                                )
                            })}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full text-center text-slate-500 py-10">
                                    {searchQuery ? 'Aranan kriterlere uygun ürün bulunamadı.' : 'Bu okul için kayıtlı ürün bulunamadı.'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* SAĞ: SEPET */}
            <div className="w-96 bg-slate-800 rounded-lg flex flex-col border-l border-slate-700">
                <div className="p-4 border-b border-slate-700"><h3 className="font-bold text-white">Sepet ({cart.length})</h3></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.map(item => (
                        <div key={item.id} className="bg-slate-900 p-3 rounded flex justify-between items-center border border-slate-700">
                            <div className="text-white flex-1">
                                <div className="font-medium">{item.name}</div>
                                <div className="text-xs text-slate-400">Birim: ₺{item.selling_price}</div>
                            </div>

                            {/* Miktar Kontrolü */}
                            <div className="flex items-center gap-2 mx-2">
                                <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center hover:bg-slate-600 text-white transition-colors">
                                    <Minus size={16} />
                                </button>
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                                    className="w-16 bg-slate-950 border border-slate-700 rounded text-center text-white text-lg py-1 focus:border-indigo-500 outline-none font-bold"
                                />
                                <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="w-8 h-8 bg-slate-700 rounded flex items-center justify-center hover:bg-slate-600 text-white transition-colors">
                                    <Plus size={16} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="text-green-400 font-bold w-16 text-right">₺{(item.selling_price * item.quantity).toFixed(2)}</span>
                                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-900 border-t border-slate-700">
                    <div className="flex justify-between text-white mb-4 text-xl font-bold"><span>Toplam</span><span className="text-green-400">₺{cartTotal}</span></div>
                    <button onClick={() => setIsPaymentModalOpen(true)} disabled={cart.length === 0}
                        className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed">
                        ÖDEME AL
                    </button>
                </div>
            </div>

            {/* ÖDEME MODALI */}
            {
                isPaymentModalOpen && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
                        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-600 w-96 shadow-2xl">
                            <h2 className="text-2xl font-bold text-white mb-6 text-center">💳 Kart Okutunuz</h2>
                            <div className="text-center text-4xl mb-6">Total: <span className="text-green-400">₺{cartTotal}</span></div>
                            <input
                                ref={cardInputRef}
                                type="text"
                                value={cardId}
                                autoComplete="off"
                                onChange={(e) => setCardId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handlePayment()}
                                className="w-full bg-slate-900 text-white text-center text-xl p-4 rounded-lg border border-indigo-500 mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                placeholder="Kartı Okutunuz..."
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button onClick={() => setIsPaymentModalOpen(false)} className="flex-1 bg-slate-700 text-white py-3 rounded-lg">İptal</button>
                                <button onClick={handlePayment} disabled={processing} className="flex-1 bg-indigo-600 text-white py-3 rounded-lg font-bold">
                                    {processing ? 'İşleniyor...' : 'Onayla'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* İADE MODALI */}
            {
                isRefundModalOpen && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-800 rounded-xl w-full max-w-4xl border border-slate-600 shadow-2xl flex flex-col max-h-[80vh]">
                            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <History size={24} className="text-orange-500" />
                                    Son İşlemler ve İade
                                </h2>
                                <button onClick={() => setIsRefundModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {recentTransactions.length === 0 ? (
                                    <div className="text-center text-slate-500 py-10">Bugün hiç işlem yapılmamış.</div>
                                ) : (
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-slate-900 text-slate-400 text-xs uppercase sticky top-0">
                                            <tr>
                                                <th className="p-3">Saat</th>
                                                <th className="p-3">Müşteri</th>
                                                <th className="p-3">Ürünler</th>
                                                <th className="p-3">Tutar</th>
                                                <th className="p-3 text-right">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {recentTransactions.map((t) => (
                                                <tr key={t.id} className="hover:bg-slate-700/50">
                                                    <td className="p-3 text-slate-300 text-sm">{new Date(t.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                                                    <td className="p-3 text-white font-medium">
                                                        {t.students?.full_name || t.school_personnel?.full_name || 'Bilinmiyor'}
                                                    </td>
                                                    <td className="p-3 text-slate-400 text-sm">
                                                        {t.items_json && Array.isArray(t.items_json) ? (
                                                            t.items_json.map((i: any) => `${i.name} (x${i.quantity})`).join(', ')
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-3 text-green-400 font-bold">₺{t.amount.toFixed(2)}</td>
                                                    <td className="p-3 text-right">
                                                        <button
                                                            onClick={() => handleRefund(t.id)}
                                                            className="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1 ml-auto"
                                                        >
                                                            <RefreshCcw size={14} /> İADE ET
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    )
}
