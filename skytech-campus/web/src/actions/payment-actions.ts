'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

// 1. ÖDEME BİLDİRİMİ OLUŞTUR (Kantinci)
export async function createPaymentNotification(amount: number) {
    const supabase = await createClient()

    // Kullanıcıyı bul
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Oturum bulunamadı' }

    // Okul ID'sini bul
    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return { success: false, error: 'Okul bilgisi bulunamadı' }

    // Bildirimi Kaydet
    const { error } = await supabase.from('payment_notifications').insert({
        school_id: profile.school_id,
        amount: amount,
        status: 'pending' // Bekliyor
    })

    if (error) {
        console.error('Bildirim Hatası:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/canteen')
    return { success: true, message: 'Bildirim başarıyla gönderildi.' }
}

// 2. ÖDEMEYİ ONAYLA (Admin - Patron)
export async function approvePayment(notificationId: string) {
    const supabase = await createClient()

    // Bildirim detayını çek
    const { data: notification } = await supabase
        .from('payment_notifications')
        .select('*')
        .eq('id', notificationId)
        .single()

    if (!notification) return { success: false, error: 'Bildirim bulunamadı' }

    // A. Bildirim durumunu güncelle
    const { error: updateError } = await supabase
        .from('payment_notifications')
        .update({ status: 'approved' })
        .eq('id', notificationId)

    if (updateError) return { success: false, error: updateError.message }

    // B. Okulun kredisini artır
    // Mevcut krediyi çek
    const { data: school } = await supabase
        .from('schools')
        .select('system_credit')
        .eq('id', notification.school_id)
        .single()

    const newCredit = (school?.system_credit || 0) + notification.amount

    // Krediyi güncelle
    await supabase
        .from('schools')
        .update({ system_credit: newCredit })
        .eq('id', notification.school_id)

    // C. Log tut
    await supabase.from('admin_credit_logs').insert({
        school_id: notification.school_id,
        amount: notification.amount,
        note: 'IBAN Ödeme Onayı (Otomatik Yükleme)'
    })

    // Tüm ilgili sayfaları revalidate et
    revalidatePath('/dashboard')
    revalidatePath('/dashboard/schools')
    revalidatePath('/canteen')
    return { success: true, message: 'Ödeme onaylandı ve kredi yüklendi.' }
}

// 3. ÖDEMEYİ REDDET (Admin)
export async function rejectPayment(notificationId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('payment_notifications')
        .update({ status: 'rejected' })
        .eq('id', notificationId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/dashboard')
    return { success: true, message: 'Ödeme reddedildi.' }
}

// 4. Bekleyen Bildirimleri Getir (Admin)
export async function getPendingNotifications() {
    const supabase = await createClient()

    try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return []

        const { data: notifications, error } = await supabase
            .from('payment_notifications')
            .select(`
                id,
                amount,
                created_at,
                status,
                schools (name)
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (error) throw error
        return notifications || []

    } catch (error) {
        console.error('Bildirim çekme hatası:', error)
        return []
    }
}
