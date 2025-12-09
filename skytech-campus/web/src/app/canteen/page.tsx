'use client'

import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
    Wallet, TrendingUp, TrendingDown, AlertCircle, Calendar, DollarSign, Package, Trophy, Lock, Unlock, Eye, EyeOff, X, Tag
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { createPaymentNotification } from '@/actions/payment-actions'

export const dynamic = 'force-dynamic'

// Türkçe karakterleri İngilizce karşılıklarına çeviren yardımcı fonksiyon (PDF için)
const latinify = (str: string) => {
    if (!str) return ''
    const mapping: { [key: string]: string } = {
        'ğ': 'g', 'Ğ': 'G',
        'ü': 'u', 'Ü': 'U',
        'ş': 's', 'Ş': 'S',
        'ı': 'i', 'İ': 'I',
        'ö': 'o', 'Ö': 'O',
        'ç': 'c', 'Ç': 'C'
    }
    return str.split('').map(char => mapping[char] || char).join('')
}

export default function CanteenDashboard() {
    const supabase = createClient()

    // Veri State'leri
    const [loading, setLoading] = useState(true)
    const [schoolName, setSchoolName] = useState('')
    const [systemCredit, setSystemCredit] = useState(0)
    const [privacyPin, setPrivacyPin] = useState('') // DB'den gelen PIN

    // Ödeme Bildirim State'leri
    const [paymentModal, setPaymentModal] = useState({ open: false })
    const [paymentAmount, setPaymentAmount] = useState('')
    const [paymentNotifications, setPaymentNotifications] = useState<any[]>([])
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Gizlilik ve PIN State'leri
    const [isFinancialsVisible, setIsFinancialsVisible] = useState(false)
    const [showPinDialog, setShowPinDialog] = useState(false)
    const [pinInput, setPinInput] = useState('')
    const [pinError, setPinError] = useState(false)

    // Muhasebe Verileri
    const [stats, setStats] = useState({
        revenue: 0,      // Ciro
        cost: 0,         // Maliyet
        grossProfit: 0,  // Brüt Kâr
        netProfit: 0,    // Net Kâr
        totalExpense: 0, // Toplam Gider
        totalDeposits: 0, // Toplam Bakiye Yüklemeleri
        totalWalletBalance: 0, // Toplam Cüzdan Bakiyesi (Kullanılmamış)
        criticalStock: 0 // Kritik Stok Sayısı
    })

    // Karşılaştırmalı Analiz (Geçen Ay vs Bu Ay)
    const [comparison, setComparison] = useState({
        lastMonth: {
            revenue: 0,
            netProfit: 0,
            totalExpense: 0,
            dateRange: '' // Tarih aralığı
        },
        thisMonth: {
            revenue: 0,
            netProfit: 0,
            totalExpense: 0,
            dateRange: '' // Tarih aralığı
        }
    })

    // Nakit Akışı
    const [cashFlow, setCashFlow] = useState({
        income: 0,   // Girdiler (Satışlar)
        outcome: 0,  // Çıktılar (Giderler)
        net: 0       // Net (Girdi - Çıktı)
    })

    // Grafik Verileri
    const [revenueChartData, setRevenueChartData] = useState<any[]>([])
    const [topProductsChartData, setTopProductsChartData] = useState<any[]>([])
    const [topProfitProductsChartData, setTopProfitProductsChartData] = useState<any[]>([])

    // Filtre State'i (varsayılan: bugün)
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('today')
    
    // Custom date range state
    const [customDateRange, setCustomDateRange] = useState({
        startDate: new Date().toISOString().split('T')[0], // Bugün (ISO format: YYYY-MM-DD)
        endDate: new Date().toISOString().split('T')[0] // Bugün (ISO format: YYYY-MM-DD)
    })
    const [customDateRangeDisplay, setCustomDateRangeDisplay] = useState({
        startDate: '', // Görüntüleme için (GG.AA.YYYY)
        endDate: '' // Görüntüleme için (GG.AA.YYYY)
    })
    const [showDateRangePicker, setShowDateRangePicker] = useState(false)
    const [isApplyingDateRange, setIsApplyingDateRange] = useState(false)
    
    // Tarih aralığı hesaplama fonksiyonu
    const getDateRange = (filter: 'today' | 'week' | 'month' | 'all' | 'custom') => {
        if (filter === 'custom') {
            const start = new Date(customDateRange.startDate)
            const end = new Date(customDateRange.endDate)
            return `${start.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${end.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        }
        const now = new Date()
        if (filter === 'today') {
            const today = new Date(now)
            return today.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        } else if (filter === 'week') {
            const startOfWeek = new Date(now)
            const day = startOfWeek.getDay() || 7
            if (day !== 1) startOfWeek.setHours(-24 * (day - 1))
            startOfWeek.setHours(0, 0, 0, 0)
            const endOfWeek = new Date(now)
            return `${startOfWeek.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${endOfWeek.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        } else if (filter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            return `${startOfMonth.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
        }
        return 'Tümü'
    }

    // Bildirimleri Çek
    const fetchNotifications = async (schoolId: string) => {
        const { data } = await supabase
            .from('payment_notifications')
            .select('*')
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false })
            .limit(10)

        if (data) setPaymentNotifications(data)
    }

    // Bildirim Gönder
    const handlePaymentSubmit = async () => {
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            alert('Lütfen geçerli bir tutar giriniz.')
            return
        }

        setIsSubmitting(true)
        const result = await createPaymentNotification(parseFloat(paymentAmount))
        setIsSubmitting(false)

        if (result.success) {
            alert('✅ ' + result.message)
            setPaymentAmount('')
            // Listeyi yenile
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
                if (profile?.school_id) fetchNotifications(profile.school_id)
            }
        } else {
            alert('❌ Hata: ' + result.error)
        }
    }

    // PIN Kontrolü (State üzerinden)
    const handlePinSubmit = () => {
        console.log("DB PIN:", privacyPin) // Debug için
        console.log("Girilen PIN:", pinInput)

        if (!privacyPin) {
            console.error("HATA: Veritabanından PIN çekilemedi veya boş!")
            setPinError(true)
            return
        }

        if (pinInput.trim() === privacyPin.trim()) {
            setIsFinancialsVisible(true)
            setShowPinDialog(false)
            setPinInput('')
            setPinError(false)
        } else {
            setPinError(true)
        }
    }

    const togglePrivacy = () => {
        if (isFinancialsVisible) {
            setIsFinancialsVisible(false)
        } else {
            setShowPinDialog(true)
        }
    }

    const handleDownloadReport = () => {
        const doc = new jsPDF()

        doc.setFontSize(18)
        doc.text(`${latinify(schoolName)} - Finansal Rapor`, 14, 22)

        doc.setFontSize(12)
        const dateRangeText = timeFilter === 'custom' 
            ? `Rapor Tarihi: ${getDateRange('custom')}`
            : `Rapor Tarihi: ${getDateRange(timeFilter)}`
        doc.text(dateRangeText, 14, 30)
        doc.text(`Filtre: ${timeFilter === 'today' ? 'Bugün' : timeFilter === 'week' ? 'Bu Hafta' : timeFilter === 'month' ? 'Bu Ay' : timeFilter === 'custom' ? 'Özel Tarih Aralığı' : 'Tümü'}`, 14, 36)

        // Finansal Özet Tablosu
        // Finansal Özet Tablosu (Detaylı Gelir Tablosu)
        autoTable(doc, {
            startY: 45,
            head: [['Kalem', 'Tutar']],
            body: [
                ['Toplam Ciro (+)', `${stats.revenue.toFixed(2)} TL`],
                ['Urun Maliyeti (-)', `-${stats.cost.toFixed(2)} TL`],
                ['BRUT URUN KARI (=)', `${stats.grossProfit.toFixed(2)} TL`],
                ['Genel Giderler (-)', `-${stats.totalExpense.toFixed(2)} TL`],
                ['NET KAR (=)', `${stats.netProfit.toFixed(2)} TL`],
                ['', ''],
                ['BAKIYE YUKLEMELERI (+)', `${stats.totalDeposits.toFixed(2)} TL`],
                ['KULLANILMAMIS BAKIYE (-)', `-${stats.totalWalletBalance.toFixed(2)} TL`],
                ['GERCEK NET KAR (=)', `${(stats.netProfit + stats.totalDeposits - stats.totalWalletBalance).toFixed(2)} TL`]
            ],
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 50, halign: 'right' }
            },
            didParseCell: function (data) {
                // Türkçe karakterleri latinize et (sadece metin, sayıları değil)
                if (data.cell.text) {
                    data.cell.text = data.cell.text.map((t: any) => {
                        if (typeof t === 'string') {
                            // Sayı içeren string'leri kontrol et (örn: "1000.00 TL", "-500.00 TL")
                            if (/^-?\d+\.?\d*\s*TL$/.test(t.trim())) {
                                return t // Sayı formatlarını olduğu gibi bırak
                            }
                            return latinify(t)
                        }
                        return t
                    })
                }

                // Stil Ayarlamaları
                if (data.section === 'body') {
                    if (data.row.index === 2) { // Brüt Kâr
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                    if (data.row.index === 4) { // Net Kâr
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fontSize = 12;
                        if (stats.netProfit >= 0) {
                            data.cell.styles.textColor = [22, 163, 74]; // Green
                        } else {
                            data.cell.styles.textColor = [220, 38, 38]; // Red
                        }
                    }
                }
            }
        })

        // En Çok Satanlar Tablosu
        if (topProductsChartData.length > 0) {
            const startY = (doc as any).lastAutoTable.finalY + 10
            doc.text('En Cok Satan Urunler (Performans)', 14, startY)
            autoTable(doc, {
                startY: startY + 5,
                head: [['Ürün Adı', 'Satış Adedi']],
                body: topProductsChartData.map(p => [latinify(p.name), p.quantity]),
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [45, 55, 72] },
                bodyStyles: { textColor: [255, 255, 255] },
                didParseCell: function (data) {
                    if (data.cell.text) {
                        data.cell.text = data.cell.text.map((t: any) => {
                            if (typeof t === 'string') {
                                // Sayı içeren string'leri kontrol et
                                if (/^\d+$/.test(t.trim())) {
                                    return t // Sadece sayı olan string'leri olduğu gibi bırak
                                }
                                return latinify(t)
                            }
                            return t
                        })
                    }
                }
            })
        }

        // En Çok Kâr Getirenler Tablosu
        if (topProfitProductsChartData.length > 0 && isFinancialsVisible) {
            const startY = (doc as any).lastAutoTable.finalY + 10
            doc.text('En Cok Kar Getiren Urunler (Top 5)', 14, startY)
            autoTable(doc, {
                startY: startY + 5,
                head: [['Ürün Adı', 'Toplam Kâr (TL)']],
                body: topProfitProductsChartData.map(p => [latinify(p.name), p.profit.toFixed(2)]),
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
                headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
                alternateRowStyles: { fillColor: [45, 55, 72] },
                bodyStyles: { textColor: [255, 255, 255] },
                didParseCell: function (data) {
                    if (data.cell.text) {
                        data.cell.text = data.cell.text.map((t: any) => {
                            if (typeof t === 'string') {
                                // Sayı içeren string'leri kontrol et
                                if (/^\d+$/.test(t.trim())) {
                                    return t // Sadece sayı olan string'leri olduğu gibi bırak
                                }
                                return latinify(t)
                            }
                            return t
                        })
                    }
                }
            })
        }

        doc.save('finansal_rapor.pdf')
    }

    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null

        const setupRealtime = async () => {
            // Önce okul ID'sini al
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('school_id')
                .eq('id', user.id)
                .single()

            if (!profile?.school_id) return

            // Realtime subscription - Okul kredisi değişikliklerini dinle
            channel = supabase
                .channel(`school-credit-updates-${profile.school_id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'schools',
                        filter: `id=eq.${profile.school_id}`
                    },
                    (payload) => {
                        console.log('🔔 Okul kredisi güncellendi:', payload)
                        // Krediyi güncelle
                        if (payload.new && 'system_credit' in payload.new) {
                            setSystemCredit(payload.new.system_credit as number)
                        }
                        // Dashboard verilerini yenile
                        fetchDashboardData()
                    }
                )
                .subscribe()
        }

        fetchDashboardData()
        setupRealtime()

        return () => {
            if (channel) {
                supabase.removeChannel(channel)
            }
        }
    }, [timeFilter, customDateRange, supabase])

    const fetchDashboardData = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Profil ve Okul ID'sini al
            const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single()
            if (!profile?.school_id) return
            const schoolId = profile.school_id

            // 2. Okul Bilgilerini (Kredi, İsim ve PIN) Çek - Cache bypass ile
            const { data: school, error: schoolError } = await supabase
                .from('schools')
                .select('name, system_credit, privacy_pin')
                .eq('id', schoolId)
                .single()
            
            if (schoolError) {
                console.error('Okul bilgisi çekilirken hata:', schoolError)
            }
            
            if (school) {
                setSchoolName(school.name.toUpperCase())
                setSystemCredit(school.system_credit || 0)
                setPrivacyPin(school.privacy_pin || '') // PIN'i state'e at
                fetchNotifications(schoolId) // Bildirimleri de çek
            }

            // 3. Tarih Filtresini Ayarla
            const now = new Date()
            let startDate = new Date(0).toISOString() // Başlangıç: En eski tarih
            let endDate = new Date().toISOString() // Bitiş: Şimdi

            if (timeFilter === 'today') {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                startDate = today.toISOString()
                endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString() // Bugünün sonu
            } else if (timeFilter === 'week') {
                const startOfWeek = new Date(now)
                const day = startOfWeek.getDay() || 7 // Pazar 0 ise 7 yap
                if (day !== 1) startOfWeek.setHours(-24 * (day - 1))
                startOfWeek.setHours(0, 0, 0, 0)
                startDate = startOfWeek.toISOString()
                endDate = now.toISOString()
            } else if (timeFilter === 'month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
                startDate = startOfMonth.toISOString()
                endDate = now.toISOString()
            } else if (timeFilter === 'custom') {
                const start = new Date(customDateRange.startDate)
                start.setHours(0, 0, 0, 0)
                startDate = start.toISOString()
                const end = new Date(customDateRange.endDate)
                end.setHours(23, 59, 59, 999)
                endDate = end.toISOString()
            }

            // 4. Verileri Paralel Çek (Transactions, Expenses, Products)
            // ÖNEMLİ: Muhasebe sadece KASA/SATIŞ işlemlerini göstermeli, SİPARİŞ teslim işlemlerini DEĞİL
            // Filtre: canteen_id IS NOT NULL (Kasa/Satış'tan yapılan işlemler) VEYA items_json.source !== 'MOBİL_SİPARİŞ'
            const [transactionsRes, expensesRes, productsRes] = await Promise.all([
                supabase.from('transactions')
                    .select('id, amount, transaction_type, created_at, items_json, student_id, personnel_id, canteen_id')
                    .eq('school_id', schoolId)
                    .not('canteen_id', 'is', null) // SADECE KASA/SATIŞ İŞLEMLERİ (canteen_id olanlar)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)
                    .order('created_at', { ascending: true })
                    .limit(10000), // PERFORMANS: Dashboard için maksimum 10,000 transaction

                supabase.from('expenses')
                    .select('*')
                    .eq('school_id', schoolId)
                    .gte('expense_date', startDate.split('T')[0]) // expense_date DATE tipinde, sadece tarih kısmını al
                    .lte('expense_date', endDate.split('T')[0]),

                supabase.from('products')
                    .select('id, stock_quantity')
                    .eq('school_id', schoolId)
                    .lt('stock_quantity', 10) // Kritik stok filtresi
            ])

            let transactions = transactionsRes.data || []
            const expensesList = expensesRes.data || []
            const criticalProducts = productsRes.data || []

            // EK FİLTRE: items_json içinde source: 'MOBİL_SİPARİŞ' olanları da çıkar (güvenlik için)
            // Çünkü bazı eski transaction'larda canteen_id olmayabilir ama source: 'MOBİL_SİPARİŞ' olabilir
            transactions = transactions.filter(t => {
                // Eğer items_json bir obje ise ve source: 'MOBİL_SİPARİŞ' varsa çıkar
                if (t.items_json && typeof t.items_json === 'object' && !Array.isArray(t.items_json)) {
                    if (t.items_json.source === 'MOBİL_SİPARİŞ' || t.items_json.note === 'Mobil Sipariş Teslimi') {
                        return false; // Sipariş teslim işlemi, muhasebeye dahil etme
                    }
                }
                // Eğer items_json bir array ise ve içinde source: 'MOBİL_SİPARİŞ' varsa çıkar
                if (t.items_json && Array.isArray(t.items_json) && t.items_json.length > 0) {
                    const firstItem = t.items_json[0];
                    if (firstItem && firstItem.source === 'MOBİL_SİPARİŞ') {
                        return false; // Sipariş teslim işlemi, muhasebeye dahil etme
                    }
                }
                return true; // Kasa/Satış işlemi, muhasebeye dahil et
            })

            // --- HESAPLAMALAR ---

            // A. Ciro (Revenue) - Sadece 'purchase' işlemleri (KASA/SATIŞ'tan yapılanlar)
            // amount negatif olabilir, mutlak değer al (ciro pozitif olmalı)
            const totalRevenue = transactions
                .filter(t => t.transaction_type === 'purchase')
                .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)

            // A.1. Bakiye Yüklemeleri (Deposit) - Muhasebe için
            const totalDeposits = transactions
                .filter(t => t.transaction_type === 'deposit')
                .reduce((sum, t) => sum + (t.amount || 0), 0)

            // B. Maliyet (Cost) - items_json içinden buying_price * quantity
            let totalCost = 0
            const productSalesMap = new Map<string, number>() // Ürün adı -> Satış adedi
            const productProfitMap = new Map<string, number>() // Ürün adı -> Toplam kâr

            transactions.forEach(t => {
                // items_json array veya obje olabilir
                let items: any[] = []
                
                if (Array.isArray(t.items_json)) {
                    items = t.items_json
                } else if (t.items_json && typeof t.items_json === 'object') {
                    // Eğer items_json bir obje ise ve items array'i varsa
                    if (t.items_json.items && Array.isArray(t.items_json.items)) {
                        items = t.items_json.items
                    } else {
                        // Direkt obje ise (eski format), tek item olarak işle
                        items = [t.items_json]
                    }
                }
                
                items.forEach((item: any) => {
                    // Sadece KASA/SATIŞ işlemlerini işle (source kontrolü)
                    if (item.source === 'MOBİL_SİPARİŞ') {
                        return; // Sipariş teslim işlemi, atla
                    }
                    
                    const buyingPrice = item.buying_price || item.buy_price || 0
                    const sellingPrice = item.selling_price || item.sell_price || 0
                    const quantity = item.quantity || 1
                    totalCost += buyingPrice * quantity

                    // Ürün Satış Adetlerini Topla (Top 5 için)
                    const currentQty = productSalesMap.get(item.name) || 0
                    productSalesMap.set(item.name, currentQty + quantity)

                    // Ürün Kârını Topla (En Çok Kâr Getirenler için)
                    const profitPerUnit = sellingPrice - buyingPrice
                    const totalProfit = profitPerUnit * quantity
                    const currentProfit = productProfitMap.get(item.name) || 0
                    productProfitMap.set(item.name, currentProfit + totalProfit)
                })
            })

            // C. Toplam Gider
            const totalExpense = expensesList.reduce((sum, e) => sum + (e.amount || 0), 0)

            // D. Kârlar
            const grossProfit = totalRevenue - totalCost
            const netProfit = grossProfit - totalExpense

            // D.1. Toplam Cüzdan Bakiyesi (Öğrenci ve Personel)
            const [studentsRes, personnelRes] = await Promise.all([
                supabase.from('students')
                    .select('wallet_balance')
                    .eq('school_id', schoolId),
                supabase.from('school_personnel')
                    .select('wallet_balance')
                    .eq('school_id', schoolId)
            ])
            
            const totalWalletBalance = (studentsRes.data || []).reduce((sum, s) => sum + (s.wallet_balance || 0), 0) +
                                     (personnelRes.data || []).reduce((sum, p) => sum + (p.wallet_balance || 0), 0)

            setStats({
                revenue: totalRevenue,
                cost: totalCost,
                grossProfit: grossProfit,
                netProfit: netProfit,
                totalExpense: totalExpense,
                totalDeposits: totalDeposits,
                totalWalletBalance: totalWalletBalance,
                criticalStock: criticalProducts.length
            })

            // E. KARŞILAŞTIRMALI ANALİZ (Geçen Ay vs Bu Ay) - Sadece 'month' filtresinde göster
            if (timeFilter === 'month') {
                const now = new Date()
                const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

                // Tarih aralıklarını formatla
                const lastMonthDateRange = `${lastMonthStart.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${lastMonthEnd.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
                const thisMonthDateRange = `${thisMonthStart.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })} - ${now.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`

                // Geçen ayın verilerini çek
                const [lastMonthTransactionsRes, lastMonthExpensesRes] = await Promise.all([
                    supabase.from('transactions')
                        .select('*')
                        .eq('school_id', schoolId)
                        .gte('created_at', lastMonthStart.toISOString())
                        .lte('created_at', lastMonthEnd.toISOString())
                        .order('created_at', { ascending: true }),

                    supabase.from('expenses')
                        .select('*')
                        .eq('school_id', schoolId)
                        .gte('expense_date', lastMonthStart.toISOString().split('T')[0])
                        .lte('expense_date', lastMonthEnd.toISOString().split('T')[0])
                ])

                const lastMonthTransactions = lastMonthTransactionsRes.data || []
                const lastMonthExpenses = lastMonthExpensesRes.data || []

                // Geçen ayın hesaplamaları
                const lastMonthRevenue = lastMonthTransactions
                    .filter(t => t.transaction_type === 'purchase')
                    .reduce((sum, t) => sum + (t.amount || 0), 0)

                let lastMonthCost = 0
                lastMonthTransactions.forEach(t => {
                    if (t.items_json && Array.isArray(t.items_json)) {
                        t.items_json.forEach((item: any) => {
                            lastMonthCost += (item.buying_price || 0) * (item.quantity || 1)
                        })
                    }
                })

                const lastMonthTotalExpense = lastMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
                const lastMonthGrossProfit = lastMonthRevenue - lastMonthCost
                const lastMonthNetProfit = lastMonthGrossProfit - lastMonthTotalExpense

                setComparison({
                    lastMonth: {
                        revenue: lastMonthRevenue,
                        netProfit: lastMonthNetProfit,
                        totalExpense: lastMonthTotalExpense,
                        dateRange: lastMonthDateRange
                    },
                    thisMonth: {
                        revenue: totalRevenue,
                        netProfit: netProfit,
                        totalExpense: totalExpense,
                        dateRange: thisMonthDateRange
                    }
                })
            } else {
                // Diğer filtrelerde karşılaştırma yok
                setComparison({
                    lastMonth: { revenue: 0, netProfit: 0, totalExpense: 0, dateRange: '' },
                    thisMonth: { revenue: 0, netProfit: 0, totalExpense: 0, dateRange: '' }
                })
            }

            // F. NAKİT AKIŞI HESAPLAMASI
            const cashIncome = totalRevenue // Girdiler: Satışlar
            const cashOutcome = totalExpense // Çıktılar: Giderler
            const cashNet = cashIncome - cashOutcome

            setCashFlow({
                income: cashIncome,
                outcome: cashOutcome,
                net: cashNet
            })

            // --- GRAFİK VERİLERİ HAZIRLAMA ---

            // 1. Net Kâr Grafiği (Günlük) - Ciro yerine Net Kâr
            const dailyMap = new Map<string, { date: string, profit: number }>()

            // İşlemlerden gelen Brüt Kâr
            transactions.forEach(t => {
                const dateKey = new Date(t.created_at).toLocaleDateString('tr-TR')

                let dailyCost = 0
                if (t.items_json && Array.isArray(t.items_json)) {
                    t.items_json.forEach((item: any) => {
                        dailyCost += (item.buying_price || 0) * (item.quantity || 1)
                    })
                }

                const current = dailyMap.get(dateKey) || { date: dateKey, profit: 0 }
                current.profit += (t.amount - dailyCost)
                dailyMap.set(dateKey, current)
            })

            // Giderleri düş
            expensesList.forEach(e => {
                const dateKey = new Date(e.expense_date).toLocaleDateString('tr-TR')
                const current = dailyMap.get(dateKey)
                if (current) {
                    current.profit -= e.amount
                } else {
                    dailyMap.set(dateKey, { date: dateKey, profit: -e.amount })
                }
            })

            const netProfitData = Array.from(dailyMap.values())
            setRevenueChartData(netProfitData) // State adını değiştirmedik ama içeriği kâr oldu

            // 2. En Çok Satanlar (Top 5)
            const topProducts = Array.from(productSalesMap.entries())
                .map(([name, quantity]) => ({ name, quantity }))
                .sort((a, b) => b.quantity - a.quantity)
                .slice(0, 5)

            setTopProductsChartData(topProducts)

            // 3. En Çok Kâr Getirenler (Top 5)
            const topProfitProducts = Array.from(productProfitMap.entries())
                .map(([name, profit]) => ({ name, profit: Number(profit.toFixed(2)) }))
                .sort((a, b) => b.profit - a.profit)
                .slice(0, 5)

            setTopProfitProductsChartData(topProfitProducts)

        } catch (error) {
            console.error("Dashboard hatası:", error)
        } finally {
            setLoading(false)
        }
    }

    // Custom date range uygula
    const applyCustomDateRange = () => {
        if (new Date(customDateRange.startDate) > new Date(customDateRange.endDate)) {
            alert('Başlangıç tarihi bitiş tarihinden sonra olamaz!')
            return
        }
        setIsApplyingDateRange(true)
        setTimeFilter('custom')
        setShowDateRangePicker(false)
        // Verileri yenile
        setTimeout(() => {
            setIsApplyingDateRange(false)
        }, 1000)
    }

    if (loading) return <div className="p-10 text-white text-center">Veriler Analiz Ediliyor...</div>

    return (
        <div className="p-6 space-y-6 bg-slate-950 min-h-screen text-slate-200 relative">

            {/* PIN Dialog */}
            {showPinDialog && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-2xl w-80">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                <Lock size={20} className="text-indigo-500" /> Güvenlik
                            </h3>
                            <button onClick={() => { setShowPinDialog(false); setPinInput(''); setPinError(false) }} className="text-slate-400 hover:text-white">
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-slate-400 mb-4">Finansal verileri görüntülemek için PIN giriniz.</p>

                        <input
                            type="password"
                            value={pinInput}
                            onChange={(e) => setPinInput(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-center text-2xl tracking-widest text-white focus:outline-none focus:border-indigo-500 mb-2"
                            placeholder="****"
                            maxLength={4}
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                        />

                        {pinError && <div className="text-red-500 text-xs text-center mb-2">Hatalı PIN! Tekrar deneyin.</div>}

                        <button
                            onClick={handlePinSubmit}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg font-bold transition-all mt-2"
                        >
                            Kilidi Aç
                        </button>
                    </div>
                </div>
            )}

            {/* ÜST BAŞLIK */}
            <div className="flex justify-between items-center bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                            {schoolName} - FİNANSAL ANALİZ
                        </h1>
                        <button
                            onClick={togglePrivacy}
                            className="text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-slate-800"
                            title={isFinancialsVisible ? "Gizle" : "Göster"}
                        >
                            {isFinancialsVisible ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                    <p className="text-slate-400 text-sm">Gerçek zamanlı muhasebe ve stok durumu.</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Filtre Butonları */}
                    <div className="flex flex-col gap-2 relative">
                        <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800">
                            <button onClick={() => setTimeFilter('today')} className={`px-3 py-1 text-xs rounded-md transition-all ${timeFilter === 'today' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Bugün</button>
                            <button onClick={() => setTimeFilter('week')} className={`px-3 py-1 text-xs rounded-md transition-all ${timeFilter === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Bu Hafta</button>
                            <button onClick={() => setTimeFilter('month')} className={`px-3 py-1 text-xs rounded-md transition-all ${timeFilter === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Bu Ay</button>
                            <button onClick={() => setTimeFilter('all')} className={`px-3 py-1 text-xs rounded-md transition-all ${timeFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Tümü</button>
                            <button 
                                onClick={() => setShowDateRangePicker(!showDateRangePicker)} 
                                className={`px-3 py-1 text-xs rounded-md transition-all ${timeFilter === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                            >
                                📅 Özel
                            </button>
                        </div>
                        {timeFilter !== 'all' && (
                            <div className="text-xs text-slate-500 text-center">
                                {getDateRange(timeFilter)}
                            </div>
                        )}
                        
                        {/* Date Range Picker Dropdown */}
                        {showDateRangePicker && (
                            <div className="absolute top-full left-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-2xl z-50 min-w-[320px]">
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Başlangıç Tarihi</label>
                                        <input
                                            type="text"
                                            placeholder="GG.AA.YYYY (örn: 01.01.2025)"
                                            className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                                            value={customDateRangeDisplay.startDate || (() => {
                                                const date = customDateRange.startDate.split('-')
                                                return date.length === 3 ? `${date[2]}.${date[1]}.${date[0]}` : ''
                                            })()}
                                            onChange={(e) => {
                                                // Sadece rakam ve nokta kabul et
                                                let value = e.target.value.replace(/[^\d.]/g, '')
                                                // Maksimum uzunluk kontrolü
                                                if (value.length <= 10) {
                                                    // Sadece görüntüleme için değeri sakla
                                                    setCustomDateRangeDisplay(prev => ({ ...prev, startDate: value }))
                                                }
                                            }}
                                            onBlur={(e) => {
                                                // Blur olduğunda formatı düzelt ve ISO formatına çevir
                                                const value = e.target.value.trim()
                                                const parts = value.split('.')
                                                
                                                if (parts.length === 3) {
                                                    let day = parts[0].replace(/\D/g, '').padStart(2, '0')
                                                    let month = parts[1].replace(/\D/g, '').padStart(2, '0')
                                                    let year = parts[2].replace(/\D/g, '')
                                                    
                                                    // Yıl kontrolü - 4 haneli olmalı
                                                    if (year.length === 4) {
                                                        const isoDate = `${year}-${month}-${day}`
                                                        const date = new Date(isoDate)
                                                        // Geçerli tarih kontrolü
                                                        if (!isNaN(date.getTime()) && date.getFullYear().toString() === year) {
                                                            setCustomDateRange(prev => ({ ...prev, startDate: isoDate }))
                                                            setCustomDateRangeDisplay(prev => ({ ...prev, startDate: `${day}.${month}.${year}` }))
                                                        } else {
                                                            // Geçersiz tarih, mevcut değeri koru
                                                            const current = customDateRange.startDate.split('-')
                                                            if (current.length === 3) {
                                                                setCustomDateRangeDisplay(prev => ({ ...prev, startDate: `${current[2]}.${current[1]}.${current[0]}` }))
                                                            }
                                                        }
                                                    } else {
                                                        // Yıl tamamlanmamış, mevcut değeri koru
                                                        const current = customDateRange.startDate.split('-')
                                                        if (current.length === 3) {
                                                            setCustomDateRangeDisplay(prev => ({ ...prev, startDate: `${current[2]}.${current[1]}.${current[0]}` }))
                                                        }
                                                    }
                                                } else {
                                                    // Format hatalı, mevcut değeri koru
                                                    const current = customDateRange.startDate.split('-')
                                                    if (current.length === 3) {
                                                        setCustomDateRangeDisplay(prev => ({ ...prev, startDate: `${current[2]}.${current[1]}.${current[0]}` }))
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1">Bitiş Tarihi</label>
                                        <input
                                            type="text"
                                            placeholder="GG.AA.YYYY (örn: 31.12.2025)"
                                            className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                                            value={customDateRangeDisplay.endDate || (() => {
                                                const date = customDateRange.endDate.split('-')
                                                return date.length === 3 ? `${date[2]}.${date[1]}.${date[0]}` : ''
                                            })()}
                                            onChange={(e) => {
                                                // Sadece rakam ve nokta kabul et
                                                let value = e.target.value.replace(/[^\d.]/g, '')
                                                // Maksimum uzunluk kontrolü
                                                if (value.length <= 10) {
                                                    // Sadece görüntüleme için değeri sakla
                                                    setCustomDateRangeDisplay(prev => ({ ...prev, endDate: value }))
                                                }
                                            }}
                                            onBlur={(e) => {
                                                // Blur olduğunda formatı düzelt ve ISO formatına çevir
                                                const value = e.target.value.trim()
                                                const parts = value.split('.')
                                                
                                                if (parts.length === 3) {
                                                    let day = parts[0].replace(/\D/g, '').padStart(2, '0')
                                                    let month = parts[1].replace(/\D/g, '').padStart(2, '0')
                                                    let year = parts[2].replace(/\D/g, '')
                                                    
                                                    // Yıl kontrolü - 4 haneli olmalı
                                                    if (year.length === 4) {
                                                        const isoDate = `${year}-${month}-${day}`
                                                        const date = new Date(isoDate)
                                                        // Geçerli tarih kontrolü
                                                        if (!isNaN(date.getTime()) && date.getFullYear().toString() === year) {
                                                            setCustomDateRange(prev => ({ ...prev, endDate: isoDate }))
                                                            setCustomDateRangeDisplay(prev => ({ ...prev, endDate: `${day}.${month}.${year}` }))
                                                        } else {
                                                            // Geçersiz tarih, mevcut değeri koru
                                                            const current = customDateRange.endDate.split('-')
                                                            if (current.length === 3) {
                                                                setCustomDateRangeDisplay(prev => ({ ...prev, endDate: `${current[2]}.${current[1]}.${current[0]}` }))
                                                            }
                                                        }
                                                    } else {
                                                        // Yıl tamamlanmamış, mevcut değeri koru
                                                        const current = customDateRange.endDate.split('-')
                                                        if (current.length === 3) {
                                                            setCustomDateRangeDisplay(prev => ({ ...prev, endDate: `${current[2]}.${current[1]}.${current[0]}` }))
                                                        }
                                                    }
                                                } else {
                                                    // Format hatalı, mevcut değeri koru
                                                    const current = customDateRange.endDate.split('-')
                                                    if (current.length === 3) {
                                                        setCustomDateRangeDisplay(prev => ({ ...prev, endDate: `${current[2]}.${current[1]}.${current[0]}` }))
                                                    }
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={applyCustomDateRange}
                                            disabled={isApplyingDateRange}
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                                        >
                                            {isApplyingDateRange ? 'Uygulanıyor...' : 'Uygula'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowDateRangePicker(false)
                                                // Varsayılan değerlere dön
                                                const today = new Date().toISOString().split('T')[0]
                                                setCustomDateRange({ startDate: today, endDate: today })
                                                const todayDisplay = today.split('-')
                                                setCustomDateRangeDisplay({ 
                                                    startDate: `${todayDisplay[2]}.${todayDisplay[1]}.${todayDisplay[0]}`,
                                                    endDate: `${todayDisplay[2]}.${todayDisplay[1]}.${todayDisplay[0]}`
                                                })
                                            }}
                                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-xs font-bold transition-colors"
                                        >
                                            İptal
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* PDF İndir Butonu */}
                    {/* PDF İndir Butonu - GÜVENLİK EKLENDİ */}
                    <button
                        onClick={() => {
                            if (isFinancialsVisible) {
                                handleDownloadReport()
                            } else {
                                setShowPinDialog(true)
                            }
                        }}
                        className={`${isFinancialsVisible ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-700 hover:bg-slate-600'} text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs shadow-lg transition-all`}
                    >
                        {isFinancialsVisible ? (
                            <>📄 Rapor İndir</>
                        ) : (
                            <><Lock size={14} /> Rapor (Kilitli)</>
                        )}
                    </button>

                    {/* Kredi Yükle Butonu */}
                    <button
                        onClick={() => setPaymentModal({ open: true })}
                        className="bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-lg font-bold flex items-center gap-2 text-xs shadow-lg hover:shadow-green-900/20 transition-all animate-pulse"
                    >
                        <Wallet size={16} />
                        Kredi Yükle / Bildir
                    </button>

                    {/* Sistem Kredisi */}
                    <div className={`px-4 py-2 rounded-lg border flex flex-col items-end transition-all duration-500 ${systemCredit < 100 ? 'bg-red-900/20 border-red-500/50 animate-pulse' : 'bg-slate-800 border-slate-700'}`}>
                        <span className="text-xs text-slate-400 font-bold uppercase">Sistem Kredisi</span>
                        <span className={`text-lg font-bold transition-all duration-500 ${systemCredit < 100 ? 'text-red-400 animate-pulse' : 'text-green-400'}`}>
                            ₺{systemCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                {/* 1. CİRO */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-blue-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet size={64} className="text-blue-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><DollarSign size={20} /></div>
                        <h3 className="text-slate-400 font-bold text-sm">TOPLAM CİRO</h3>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {isFinancialsVisible ? `₺${stats.revenue.toFixed(2)}` : '**** ₺'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Brüt Satış Geliri</div>
                </div>

                {/* YENİ: ÜRÜN SATIŞ KÂRI (GROSS PROFIT) */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-indigo-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Tag size={64} className="text-indigo-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Tag size={20} /></div>
                        <h3 className="text-slate-400 font-bold text-sm">ÜRÜN SATIŞ KÂRI</h3>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {isFinancialsVisible ? `₺${stats.grossProfit.toFixed(2)}` : '**** ₺'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Sadece Ürün Satış Kârı</div>
                </div>

                {/* 2. NET KÂR */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-green-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        {stats.netProfit >= 0 ? <TrendingUp size={64} className="text-green-500" /> : <TrendingDown size={64} className="text-red-500" />}
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg ${stats.netProfit >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {stats.netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                        <h3 className="text-slate-400 font-bold text-sm">NET KÂR</h3>
                    </div>
                    <div className={`text-3xl font-bold ${stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {isFinancialsVisible ? `₺${stats.netProfit.toFixed(2)}` : '**** ₺'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Ciro - (Maliyet + Giderler)</div>
                </div>

                {/* 3. TOPLAM GİDER */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-orange-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet size={64} className="text-orange-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400"><AlertCircle size={20} /></div>
                        <h3 className="text-slate-400 font-bold text-sm">TOPLAM GİDER</h3>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {isFinancialsVisible ? `₺${stats.totalExpense.toFixed(2)}` : '**** ₺'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Fatura, Personel, Kira vb.</div>
                </div>

                {/* 4. KRİTİK STOK (HER ZAMAN AÇIK) */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-yellow-500/50 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Package size={64} className="text-yellow-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400"><AlertCircle size={20} /></div>
                        <h3 className="text-slate-400 font-bold text-sm">KRİTİK STOK</h3>
                    </div>
                    <div className="text-3xl font-bold text-white">{stats.criticalStock}</div>
                    <div className="text-xs text-slate-500 mt-1">10 adetten az kalan ürünler</div>
                </div>
            </div>

            {/* KARŞILAŞTIRMALI ANALİZ (Sadece Aylık Filtrede) */}
            {timeFilter === 'month' && comparison.thisMonth.revenue > 0 && (
                <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <TrendingUp size={24} className="text-indigo-400" />
                            Geçen Ay vs Bu Ay Karşılaştırması
                        </h3>
                        <div className="text-xs text-slate-400">
                            <div>Geçen Ay: {comparison.lastMonth.dateRange}</div>
                            <div>Bu Ay: {comparison.thisMonth.dateRange}</div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Ciro Karşılaştırması */}
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                            <div className="text-xs text-slate-400 uppercase font-bold mb-2">Toplam Ciro</div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <div className="text-sm text-slate-500">Geçen Ay:</div>
                                <div className="text-lg font-bold text-slate-300">
                                    {isFinancialsVisible ? `₺${comparison.lastMonth.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <div className="text-sm text-slate-500">Bu Ay:</div>
                                <div className="text-lg font-bold text-white">
                                    {isFinancialsVisible ? `₺${comparison.thisMonth.revenue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                                </div>
                            </div>
                            {isFinancialsVisible && (
                                <div className={`text-sm font-bold mt-2 ${
                                    comparison.thisMonth.revenue >= comparison.lastMonth.revenue ? 'text-green-400' : 'text-red-400'
                                }`}>
                                    {comparison.thisMonth.revenue >= comparison.lastMonth.revenue ? '↑' : '↓'} 
                                    {comparison.lastMonth.revenue > 0 
                                        ? ` %${Math.abs(((comparison.thisMonth.revenue - comparison.lastMonth.revenue) / comparison.lastMonth.revenue) * 100).toFixed(1)}`
                                        : ' Yeni veri'
                                    }
                                </div>
                            )}
                        </div>

                        {/* Net Kâr Karşılaştırması */}
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                            <div className="text-xs text-slate-400 uppercase font-bold mb-2">Net Kâr</div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <div className="text-sm text-slate-500">Geçen Ay:</div>
                                <div className={`text-lg font-bold ${comparison.lastMonth.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {isFinancialsVisible ? `₺${comparison.lastMonth.netProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <div className="text-sm text-slate-500">Bu Ay:</div>
                                <div className={`text-lg font-bold ${comparison.thisMonth.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {isFinancialsVisible ? `₺${comparison.thisMonth.netProfit.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                                </div>
                            </div>
                            {isFinancialsVisible && (
                                <div className={`text-sm font-bold mt-2 ${
                                    comparison.thisMonth.netProfit >= comparison.lastMonth.netProfit ? 'text-green-400' : 'text-red-400'
                                }`}>
                                    {comparison.thisMonth.netProfit >= comparison.lastMonth.netProfit ? '↑' : '↓'} 
                                    {comparison.lastMonth.netProfit !== 0 
                                        ? ` %${Math.abs(((comparison.thisMonth.netProfit - comparison.lastMonth.netProfit) / Math.abs(comparison.lastMonth.netProfit)) * 100).toFixed(1)}`
                                        : ' Yeni veri'
                                    }
                                </div>
                            )}
                        </div>

                        {/* Gider Karşılaştırması */}
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                            <div className="text-xs text-slate-400 uppercase font-bold mb-2">Toplam Gider</div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <div className="text-sm text-slate-500">Geçen Ay:</div>
                                <div className="text-lg font-bold text-orange-400">
                                    {isFinancialsVisible ? `₺${comparison.lastMonth.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2 mb-2">
                                <div className="text-sm text-slate-500">Bu Ay:</div>
                                <div className="text-lg font-bold text-orange-400">
                                    {isFinancialsVisible ? `₺${comparison.thisMonth.totalExpense.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                                </div>
                            </div>
                            {isFinancialsVisible && (
                                <div className={`text-sm font-bold mt-2 ${
                                    comparison.thisMonth.totalExpense <= comparison.lastMonth.totalExpense ? 'text-green-400' : 'text-red-400'
                                }`}>
                                    {comparison.thisMonth.totalExpense <= comparison.lastMonth.totalExpense ? '↓' : '↑'} 
                                    {comparison.lastMonth.totalExpense > 0 
                                        ? ` %${Math.abs(((comparison.thisMonth.totalExpense - comparison.lastMonth.totalExpense) / comparison.lastMonth.totalExpense) * 100).toFixed(1)}`
                                        : ' Yeni veri'
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NAKİT AKIŞI RAPORU */}
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Wallet size={24} className="text-green-400" />
                    Nakit Akışı Raporu
                    {timeFilter === 'today' && <span className="text-sm text-slate-400">(Bugün)</span>}
                    {timeFilter === 'week' && <span className="text-sm text-slate-400">(Bu Hafta)</span>}
                    {timeFilter === 'month' && <span className="text-sm text-slate-400">(Bu Ay)</span>}
                    {timeFilter === 'all' && <span className="text-sm text-slate-400">(Tümü)</span>}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* GİRDİLER */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-green-500/30">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-2">
                            <TrendingUp size={16} className="text-green-400" />
                            Girdiler (Para Girişi)
                        </div>
                        <div className="text-2xl font-bold text-green-400">
                            {isFinancialsVisible ? `₺${cashFlow.income.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Satışlardan gelen para</div>
                    </div>

                    {/* ÇIKTILAR */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-red-500/30">
                        <div className="text-xs text-slate-400 uppercase font-bold mb-2 flex items-center gap-2">
                            <TrendingDown size={16} className="text-red-400" />
                            Çıktılar (Para Çıkışı)
                        </div>
                        <div className="text-2xl font-bold text-red-400">
                            {isFinancialsVisible ? `₺${cashFlow.outcome.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">Giderlere giden para</div>
                    </div>

                    {/* NET */}
                    <div className={`bg-slate-900/50 rounded-lg p-4 border ${
                        cashFlow.net >= 0 ? 'border-green-500/30' : 'border-red-500/30'
                    }`}>
                        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Net Nakit Akışı</div>
                        <div className={`text-2xl font-bold ${
                            cashFlow.net >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                            {isFinancialsVisible ? `₺${cashFlow.net.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '**** ₺'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                            {cashFlow.net >= 0 ? 'Pozitif akış ✅' : 'Negatif akış ⚠️'}
                        </div>
                    </div>
                </div>
            </div>

            {/* GRAFİKLER */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">

                {/* NET KÂR GRAFİĞİ (GÜNLÜK) - GİZLİLİK MODU DESTEKLİ */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg flex flex-col relative">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-green-400" /> Net Kâr Grafiği ({
                            timeFilter === 'today' ? 'Günlük' :
                                timeFilter === 'week' ? 'Haftalık' :
                                    timeFilter === 'month' ? 'Aylık' : 'Tümü'
                        })
                    </h3>

                    <div className="flex-1 w-full min-h-0 relative">
                        {/* KİLİT EKRANI OVERLAY */}
                        {!isFinancialsVisible && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700">
                                <Lock size={48} className="text-slate-500 mb-4" />
                                <p className="text-slate-400 font-bold mb-4 text-center px-4">Finansal Grafiği Görüntülemek İçin Kilidi Açın</p>
                                <button
                                    onClick={() => setShowPinDialog(true)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg hover:shadow-indigo-500/20"
                                >
                                    Kilidi Aç
                                </button>
                            </div>
                        )}

                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={revenueChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                <YAxis stroke="#94a3b8" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    itemStyle={{ color: '#10b981' }}
                                    formatter={(value: any) => [`${value.toFixed(2)} TL`, 'Net Kâr']}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="profit" name="Net Kâr (TL)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* EN ÇOK SATANLAR (TOP 5) GRAFİĞİ (HER ZAMAN AÇIK) */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg flex flex-col">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Trophy size={18} className="text-amber-500" /> En Çok Satanlar (Top 5)
                    </h3>
                    <div className="flex-1 w-full min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topProductsChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    width={100}
                                    tick={{ fill: '#cbd5e1' }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                    formatter={(value: any) => [`${value} Adet`, 'Satış']}
                                />
                                <Bar dataKey="quantity" name="Satış Adedi" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* EN ÇOK KÂR GETİRENLER (TOP 5) GRAFİĞİ (GİZLİLİK MODU DESTEKLİ) */}
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-lg flex flex-col relative">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <DollarSign size={18} className="text-green-400" /> En Çok Kâr Getirenler (Top 5)
                    </h3>
                    <div className="flex-1 w-full min-h-0 relative">
                        {/* KİLİT EKRANI OVERLAY */}
                        {!isFinancialsVisible && (
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700">
                                <Lock size={48} className="text-slate-500 mb-4" />
                                <p className="text-slate-400 font-bold mb-4 text-center px-4">Kâr Grafiğini Görüntülemek İçin Kilidi Açın</p>
                                <button
                                    onClick={() => setShowPinDialog(true)}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-bold transition-all shadow-lg hover:shadow-indigo-500/20"
                                >
                                    Kilidi Aç
                                </button>
                            </div>
                        )}

                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topProfitProductsChartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    stroke="#94a3b8"
                                    fontSize={11}
                                    width={100}
                                    tick={{ fill: '#cbd5e1' }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                                    cursor={{ fill: '#334155', opacity: 0.4 }}
                                    formatter={(value: any) => [`₺${Number(value).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'Kâr']}
                                />
                                <Bar dataKey="profit" name="Toplam Kâr (TL)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>
            {/* ÖDEME BİLDİRİM MODALI */}
            {paymentModal.open && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-slate-900 p-6 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet size={24} className="text-green-500" /> Bakiye Yükle
                            </h3>
                            <button onClick={() => setPaymentModal({ open: false })} className="text-slate-400 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        {/* IBAN KARTI */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700 mb-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <DollarSign size={100} className="text-white" />
                            </div>
                            <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Banka Hesap Bilgileri</div>
                            <div className="text-white font-mono text-lg font-bold mb-2">TR55 0001 0026 6774 4752 9950 02</div>
                            <div className="text-sm text-slate-300">Alıcı: <span className="font-bold text-white">Aydın Sezer</span></div>
                            <div className="mt-2 text-xs text-yellow-500 flex items-center gap-1">
                                <AlertCircle size={12} />
                                <span>Lütfen açıklama kısmına <b>Okul Adını</b> yazınız.</span>
                            </div>
                        </div>

                        {/* FORM */}
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm text-slate-400 mb-1">Yatırılan Tutar (TL)</label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-green-500 font-bold text-lg"
                                    placeholder="0.00"
                                />
                            </div>
                            <button
                                onClick={handlePaymentSubmit}
                                disabled={isSubmitting}
                                className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? 'Gönderiliyor...' : 'Bildirim Gönder'}
                            </button>
                        </div>

                        {/* GEÇMİŞ BİLDİRİMLER */}
                        <div>
                            <h4 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">Son Bildirimler</h4>
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                {paymentNotifications.length === 0 ? (
                                    <div className="text-center text-slate-600 text-sm py-2">Henüz bildirim yok.</div>
                                ) : (
                                    paymentNotifications.map((n: any) => (
                                        <div key={n.id} className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                                            <div>
                                                <div className="text-white font-bold">₺{n.amount}</div>
                                                <div className="text-xs text-slate-500">{new Date(n.created_at).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-bold uppercase ${n.status === 'approved' ? 'bg-green-900/50 text-green-400' :
                                                n.status === 'rejected' ? 'bg-red-900/50 text-red-400' :
                                                    'bg-yellow-900/50 text-yellow-400'
                                                }`}>
                                                {n.status === 'approved' ? 'Onaylandı' : n.status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
