'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

// 1. Kredi Yükleme
export async function addSchoolCredit(schoolId: string, amount: number) {
    // 1. MODERN COOKIE KULLANIMI (AWAIT EKLENDİ)
    const supabase = await createClient()

    // 2. OTURUM KONTROLÜ
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        return { success: false, error: 'Oturum açılmamış. Lütfen sayfayı yenileyip tekrar deneyin.' }
    }

    // 3. MEVCUT KREDİYİ ÇEK
    const { data: school, error: fetchError } = await supabase
        .from('schools')
        .select('system_credit, name')
        .eq('id', schoolId)
        .single()

    if (fetchError || !school) {
        return { success: false, error: 'Okul bulunamadı.' }
    }

    const newCredit = Number(school.system_credit || 0) + Number(amount)

    // 4. KREDİYİ GÜNCELLE
    const { error: updateError } = await supabase
        .from('schools')
        .update({ system_credit: newCredit })
        .eq('id', schoolId)

    if (updateError) {
        return { success: false, error: 'Güncelleme hatası: ' + updateError.message }
    }

    // 5. LOG KAYDI OLUŞTUR (Patronun Defteri)
    await supabase.from('admin_credit_logs').insert({
        school_id: schoolId,
        amount: amount,
        note: `Yönetim Paneli üzerinden yükleme (${session.user.email})`
    })

    revalidatePath('/dashboard/schools')
    revalidatePath('/dashboard')
    return { success: true, message: `${school.name} okuluna ₺${amount} kredi yüklendi. Yeni Bakiye: ₺${newCredit}` }
}

// 2. Komisyon Oranını Al (Yüzde bazlı - eski sistem)
export async function getCommissionRate() {
    const supabase = await createClient()
    try {
        const { data } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'commission_rate')
            .single()
        
        return data ? parseFloat(data.setting_value) : 1.0 // Varsayılan %1.0
    } catch (error) {
        console.error('Komisyon oranı alınırken hata:', error)
        return 1.0 // Varsayılan
    }
}

// 3. Komisyon Tutarını Hesapla (Fiyat Bazlı Kurallar)
export async function calculateCommission(amount: number): Promise<number> {
    const supabase = await createClient()
    try {
        // Önce kuralları çek (öncelik sırasına göre)
        const { data: rules } = await supabase
            .from('commission_rules')
            .select('*')
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('min_price', { ascending: true })

        if (!rules || rules.length === 0) {
            // Kural yoksa yüzde bazlı sistemi kullan
            const rate = await getCommissionRate()
            return (amount * rate) / 100
        }

        // Kuralları kontrol et
        for (const rule of rules) {
            if (amount >= rule.min_price) {
                if (rule.max_price === null || amount <= rule.max_price) {
                    return rule.commission_amount
                }
            }
        }

        // Hiçbir kurala uymuyorsa yüzde bazlı sistemi kullan
        const rate = await getCommissionRate()
        return (amount * rate) / 100
    } catch (error) {
        console.error('Komisyon hesaplanırken hata:', error)
        // Hata durumunda yüzde bazlı sistemi kullan
        const rate = await getCommissionRate()
        return (amount * rate) / 100
    }
}

// 3. Dashboard İstatistikleri
export async function getAdminStats() {
    const supabase = await createClient()

    try {
        // Komisyon oranını al
        const commissionRate = await getCommissionRate()

        // 1. Toplam Hasılat (Komisyon Toplamı - Tüm Satışlardan)
        // Tüm satış işlemlerini say (transaction_type = 'sale' veya 'purchase')
        const { data: allSales, error: salesError } = await supabase
            .from('transactions')
            .select('id, created_at')
            .in('transaction_type', ['sale', 'purchase'])
        
        const totalSalesCount = allSales?.length || 0
        const totalRevenue = totalSalesCount * commissionRate

        // 2. Günlük Kazanç (Bugün yapılan satışların komisyon toplamı)
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayStr = today.toISOString()
        
        const { data: todaySales } = await supabase
            .from('transactions')
            .select('id')
            .in('transaction_type', ['sale', 'purchase'])
            .gte('created_at', todayStr)
        
        const todaySalesCount = todaySales?.length || 0
        const dailyRevenue = todaySalesCount * commissionRate

        // 3. Aylık Kazanç (Bu ay yapılan satışların komisyon toplamı)
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
        const monthStartStr = monthStart.toISOString()
        
        const { data: monthSales } = await supabase
            .from('transactions')
            .select('id')
            .in('transaction_type', ['sale', 'purchase'])
            .gte('created_at', monthStartStr)
        
        const monthSalesCount = monthSales?.length || 0
        const monthlyRevenue = monthSalesCount * commissionRate

        // 4. Okullar ve Borç Durumu
        const { data: schools } = await supabase.from('schools').select('id, name, system_credit, is_active')

        const totalSchools = schools?.length || 0
        const activeSchools = schools?.filter(s => s.is_active).length || 0

        // Riskli Okullar (Kredisi 0 veya altı)
        const riskySchools = schools?.filter(s => (s.system_credit || 0) <= 0) || []
        const riskyCount = riskySchools.length

        // Toplam Alacak (Borçlu okulların eksi bakiyeleri toplamı - pozitife çevirip gösterelim)
        const totalDebt = schools?.reduce((sum, s) => {
            const credit = s.system_credit || 0
            return credit < 0 ? sum + Math.abs(credit) : sum
        }, 0) || 0

        // Borçlu Okullar Listesi (Sıralı)
        const debtorSchools = riskySchools
            .sort((a, b) => (a.system_credit || 0) - (b.system_credit || 0))
            .slice(0, 5) // İlk 5 en borçlu

        // Son 6 Aylık Tahsilat Grafiği (Komisyon bazlı - Her ayın başında yenilenir)
        const chartData = []
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
        
        // Son 6 ayı hesapla (bugünden geriye doğru)
        for (let i = 5; i >= 0; i--) {
            const targetMonth = new Date(today.getFullYear(), today.getMonth() - i, 1)
            const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1, 0, 0, 0, 0)
            const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999)
            
            // O ay içindeki tüm satışları say (komisyon hesaplamak için)
            const { data: monthSalesData } = await supabase
                .from('transactions')
                .select('id, created_at')
                .in('transaction_type', ['sale', 'purchase'])
                .gte('created_at', monthStart.toISOString())
                .lte('created_at', monthEnd.toISOString())
            
            const monthSalesCount = monthSalesData?.length || 0
            const monthCommission = monthSalesCount * commissionRate
            
            chartData.push({
                name: monthNames[targetMonth.getMonth()] + ' ' + targetMonth.getFullYear(),
                total: monthCommission
            })
        }

        return {
            totalRevenue,
            dailyRevenue,
            monthlyRevenue,
            activeSchools,
            chartData
        }

    } catch (error) {
        console.error('İstatistik hatası:', error)
        return null
    }
}

// 4. Tarih Aralığına Göre Gelir Raporu
export async function getRevenueReport(startDate: string, endDate: string) {
    const supabase = await createClient()

    try {
        const commissionRate = await getCommissionRate()

        // Tarih aralığını parse et
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)

        // Tarih aralığındaki tüm satışları çek
        const { data: allSales, error: salesError } = await supabase
            .from('transactions')
            .select('id, created_at')
            .in('transaction_type', ['sale', 'purchase'])
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: true })

        if (salesError) {
            console.error('Satış verisi çekilirken hata:', salesError)
            return null
        }

        // Günlük gelir hesaplama
        const dailyRevenue: { [key: string]: number } = {}
        allSales?.forEach(sale => {
            const dateKey = new Date(sale.created_at).toLocaleDateString('tr-TR')
            if (!dailyRevenue[dateKey]) {
                dailyRevenue[dateKey] = 0
            }
            dailyRevenue[dateKey] += commissionRate
        })

        // Aylık gelir hesaplama
        const monthlyRevenue: { [key: string]: number } = {}
        allSales?.forEach(sale => {
            const saleDate = new Date(sale.created_at)
            const monthKey = saleDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
            if (!monthlyRevenue[monthKey]) {
                monthlyRevenue[monthKey] = 0
            }
            monthlyRevenue[monthKey] += commissionRate
        })

        // Toplam gelir
        const totalRevenue = (allSales?.length || 0) * commissionRate

        // Günlük ve aylık verileri sıralı array'e çevir
        const dailyData = Object.entries(dailyRevenue)
            .map(([date, revenue]) => ({ date, revenue }))
            .sort((a, b) => new Date(a.date.split('.').reverse().join('-')).getTime() - new Date(b.date.split('.').reverse().join('-')).getTime())

        const monthlyData = Object.entries(monthlyRevenue)
            .map(([month, revenue]) => ({ month, revenue }))
            .sort((a, b) => {
                const monthNames: { [key: string]: number } = {
                    'ocak': 1, 'şubat': 2, 'mart': 3, 'nisan': 4, 'mayıs': 5, 'haziran': 6,
                    'temmuz': 7, 'ağustos': 8, 'eylül': 9, 'ekim': 10, 'kasım': 11, 'aralık': 12
                }
                const aMonth = a.month.split(' ')[0].toLowerCase()
                const bMonth = b.month.split(' ')[0].toLowerCase()
                return monthNames[aMonth] - monthNames[bMonth]
            })

        return {
            startDate: start.toLocaleDateString('tr-TR'),
            endDate: end.toLocaleDateString('tr-TR'),
            totalRevenue,
            totalSales: allSales?.length || 0,
            commissionRate,
            dailyData,
            monthlyData
        }

    } catch (error) {
        console.error('Gelir raporu hatası:', error)
        return null
    }
}
