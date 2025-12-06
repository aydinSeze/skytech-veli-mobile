'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

// ---------------------------------------------------------
// 1. PERSONEL EKLEME
// ---------------------------------------------------------
export async function addPersonnel(formData: FormData) {
    const supabase = await createClient()

    const full_name = formData.get('full_name') as string
    const role = formData.get('role') as string
    const credit_limit = formData.get('credit_limit')
    const nfc_card_id = formData.get('nfc_card_id') as string

    // Oturum Kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        console.error('Auth Error:', authError)
        return { success: false, error: 'Oturum bulunamadı. Lütfen sayfayı yenileyip tekrar giriş yapın.' }
    }

    // Okul ID'sini bul
    const { data: profile } = await supabase
        .from('profiles')
        .select('school_id')
        .eq('id', user.id)
        .single()

    if (!profile?.school_id) return { success: false, error: 'Okul bilgisi bulunamadı' }

    // Kayıt İşlemi
    const { error } = await supabase.from('school_personnel').insert({
        school_id: profile.school_id,
        full_name,
        role,
        credit_limit: Number(credit_limit) || 0,
        wallet_balance: 0,
        nfc_card_id: nfc_card_id || null,
    })

    if (error) {
        console.error('Ekleme Hatası:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/canteen/personnel')
    return { success: true }
}

// ---------------------------------------------------------
// 2. BAKİYE YÜKLEME
// ---------------------------------------------------------
export async function addPersonnelBalance(personnelId: string, amount: number) {
    const supabase = await createClient()

    // Oturum Kontrolü
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        console.error('Auth Error:', authError)
        return { success: false, error: 'Oturum bulunamadı. Lütfen sayfayı yenileyip tekrar giriş yapın.' }
    }

    // 1. Personel ve Okul Bilgisini Çek
    const { data: personnel, error: fetchError } = await supabase
        .from('school_personnel')
        .select('id, school_id, wallet_balance')
        .eq('id', personnelId)
        .single()

    if (fetchError) {
        console.error('Personel Bulunamadı:', fetchError)
        return { success: false, error: `Veri Çekme Hatası: ${fetchError.message} (Kod: ${fetchError.code})` }
    }

    if (!personnel) {
        return { success: false, error: 'Personel verisi bulunamadı.' }
    }

    // 2. Yeni bakiyeyi hesapla
    const currentBalance = personnel.wallet_balance || 0
    const newBalance = currentBalance + amount

    // 3. Güncelle
    const { error: updateError } = await supabase
        .from('school_personnel')
        .update({ wallet_balance: newBalance })
        .eq('id', personnelId)

    if (updateError) {
        console.error('Güncelleme Hatası:', updateError)
        return { success: false, error: `Güncelleme Hatası: ${updateError.message}` }
    }

    // 4. İşlem Kaydı Oluştur
    const { error: transactionError } = await supabase.from('transactions').insert({
        school_id: personnel.school_id,
        personnel_id: personnel.id,
        amount: amount,
        transaction_type: 'deposit',
        items_json: { note: 'Manuel Bakiye Yükleme (Admin)' }
    })

    if (transactionError) {
        console.error('Transaction Log Hatası:', transactionError)
        // Kritik değil, bakiye yüklendi ama log tutulamadı.
    }

    revalidatePath('/canteen/personnel')
    return { success: true }
}

// ---------------------------------------------------------
// 3. PERSONEL SİLME
// ---------------------------------------------------------
export async function deletePersonnel(personnelId: string) {
    const supabase = await createClient()

    // 1. Önce bakiyeyi kontrol et
    const { data: personnel } = await supabase
        .from('school_personnel')
        .select('wallet_balance')
        .eq('id', personnelId)
        .single()

    if (personnel && personnel.wallet_balance < 0) {
        return { success: false, error: 'Bu personelin borcu var! Silmeden önce tahsilat yapmalısınız.' }
    }

    // 2. Silme işlemi
    const { error } = await supabase
        .from('school_personnel')
        .delete()
        .eq('id', personnelId)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/canteen/personnel')
    return { success: true }
}

// ---------------------------------------------------------
// 4. PERSONEL DÜZENLEME
// ---------------------------------------------------------
export async function updatePersonnel(formData: FormData) {
    const supabase = await createClient()

    const id = formData.get('id') as string
    const nfc_card_id = formData.get('nfc_card_id') as string
    const credit_limit = formData.get('credit_limit')

    const { error } = await supabase
        .from('school_personnel')
        .update({
            nfc_card_id: nfc_card_id || null,
            credit_limit: Number(credit_limit) || 0
        })
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/canteen/personnel')
    return { success: true }
}
