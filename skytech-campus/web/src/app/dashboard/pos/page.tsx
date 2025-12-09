'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useEffect, useState, useRef } from 'react'
import confetti from 'canvas-confetti'

export default function POSPage() {
    const supabase = createClientComponentClient()
    const [products, setProducts] = useState<any[]>([])
    const [canteens, setCanteens] = useState<any[]>([])
    const [selectedCanteen, setSelectedCanteen] = useState<string>('')
    const [cart, setCart] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Ödeme Modalı State'leri
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
    const [cardId, setCardId] = useState('')
    const [processing, setProcessing] = useState(false)
    const cardInputRef = useRef<HTMLInputElement>(null)

    // 1. Kantinleri Çek
    useEffect(() => {
        const fetchCanteens = async () => {
            const { data } = await supabase.from('canteens').select('*')
            if (data && data.length > 0) {
                setCanteens(data)
                setSelectedCanteen(data[0].id)
            }
        }
        fetchCanteens()
    }, [])

    // 2. Ürünleri Çek
    useEffect(() => {
        if (!selectedCanteen) return
        const fetchProducts = async () => {
            setLoading(true)
            const { data } = await supabase.from('products').select('*').eq('canteen_id', selectedCanteen).order('name')
            setProducts(data || [])
            setLoading(false)
        }
        fetchProducts()
    }, [selectedCanteen])

    // Modal açılınca inputa odaklan
    useEffect(() => {
        if (isPaymentModalOpen && cardInputRef.current) {
            cardInputRef.current.focus()
        }
    }, [isPaymentModalOpen])

    // Sepete Ekle (Stok kontrolünü kaldırdık, eksiye düşebilir)
    const addToCart = (product: any) => {
        const existing = cart.find(item => item.id === product.id)
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item))
        } else {
            setCart([...cart, { ...product, quantity: 1 }])
        }
    }

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.id !== productId))
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
        setProcessing(true)

        try {
            const { data: student, error: studentError } = await supabase
                .from('students').select('*').eq('nfc_card_id', cardId).single()

            if (studentError || !student) {
                alert('❌ Kart Bulunamadı!')
                setProcessing(false)
                return
            }

            if (student.wallet_balance < cartTotal) {
                alert(`❌ YETERSİZ BAKİYE!\nMevcut: ₺${student.wallet_balance}`)
                setProcessing(false)
                return
            }

            const recordResult = await checkRecord(cartTotal)
            const previousBalance = student.wallet_balance || 0;
            const newBalance = previousBalance - cartTotal

            // Bakiyeyi Düş
            await supabase.from('students').update({ wallet_balance: newBalance }).eq('id', student.id)

            // Stokları Düş (Eksiye düşebilir)
            for (const item of cart) {
                const newStock = item.stock_quantity - item.quantity
                await supabase.from('products').update({ stock_quantity: newStock }).eq('id', item.id)
            }

            // Kasa/Satış işlemi - items_json içine source ekle (muhasebe filtresi için)
            const cartWithSource = cart.map(item => ({
                ...item,
                source: 'KASA_SATIŞ' // Muhasebe filtresi için
            }))

            await supabase.from('transactions').insert([{
                canteen_id: selectedCanteen, 
                student_id: student.id, 
                amount: -cartTotal, 
                transaction_type: 'purchase', 
                items_json: cartWithSource, // source: 'KASA_SATIŞ' ile
                previous_balance: previousBalance,
                new_balance: newBalance
            }])

            if (recordResult && recordResult.isRecord) {
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } })
                alert(`🚀 REKOR KIRILDI! TEBRİKLER!\n\nBugünkü Ciro (₺${recordResult.newTodayTotal}), Dünü (₺${recordResult.yesterdayTotal}) geçti!`)
            } else {
                alert(`✅ Satış Başarılı!\nKalan Bakiye: ₺${newBalance}`)
            }

            setCart([])
            setIsPaymentModalOpen(false)
            setCardId('')

            const { data } = await supabase.from('products').select('*').eq('canteen_id', selectedCanteen).order('name')
            setProducts(data || [])

        } catch (error: any) {
            alert('Hata: ' + error.message)
        } finally {
            setProcessing(false)
        }
    }

    return (
        <div className="h-[calc(100vh-100px)] flex gap-6 p-4 relative">
            {/* SOL: ÜRÜNLER */}
            <div className="flex-1 flex flex-col gap-4">
                <div className="bg-slate-800 p-4 rounded-lg flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">🛒 Hızlı Satış</h2>
                    <select className="bg-slate-900 text-white p-2 rounded border border-slate-700 w-64"
                        value={selectedCanteen} onChange={(e) => setSelectedCanteen(e.target.value)}>
                        {canteens.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex-1 bg-slate-800/50 rounded-lg p-4 overflow-y-auto">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {products.map(product => {
                            const isOutOfStock = product.stock_quantity <= 0
                            return (
                                <button key={product.id} onClick={() => addToCart(product)}
                                    className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 h-40 border transition-all relative overflow-hidden
                  ${isOutOfStock
                                            ? 'bg-red-900/20 border-red-500/50 hover:bg-red-900/30'
                                            : 'bg-slate-800 border-slate-700 hover:border-indigo-500 shadow-lg hover:bg-slate-700'}`}>

                                    {/* Stok Uyarısı (Arka Plan Yazısı) */}
                                    {isOutOfStock && (
                                        <div className="absolute top-2 right-2 text-red-500 text-xs font-bold bg-red-950 px-2 py-1 rounded">
                                            STOK YOK
                                        </div>
                                    )}

                                    <div className="font-bold text-white text-center z-10">{product.name}</div>
                                    <div className="text-green-400 font-bold text-xl z-10">₺{product.selling_price}</div>
                                    <div className={`text-xs z-10 ${isOutOfStock ? 'text-red-400 font-bold' : 'text-slate-500'}`}>
                                        Stok: {product.stock_quantity}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* SAĞ: SEPET */}
            <div className="w-96 bg-slate-800 rounded-lg flex flex-col border-l border-slate-700">
                <div className="p-4 border-b border-slate-700"><h3 className="font-bold text-white">Sepet ({cart.length})</h3></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {cart.map(item => (
                        <div key={item.id} className="bg-slate-900 p-3 rounded flex justify-between items-center border border-slate-700">
                            <div className="text-white"><div>{item.name}</div><div className="text-xs text-slate-400">{item.quantity} x ₺{item.selling_price}</div></div>
                            <div className="flex items-center gap-3"><span className="text-white font-bold">₺{item.selling_price * item.quantity}</span><button onClick={() => removeFromCart(item.id)} className="text-red-400">✕</button></div>
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
            {isPaymentModalOpen && (
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
            )}
        </div>
    )
}
