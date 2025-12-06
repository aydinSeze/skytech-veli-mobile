'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function addStudentBalance(studentId: string, amount: number) {
    const supabase = await createClient()

    try {
        // 1. Oturum Kontrolü
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            console.error('Auth Error:', authError)
            return { success: false, error: 'Oturum bulunamadı. Lütfen sayfayı yenileyip tekrar giriş yapın.' }
        }

        // 2. Öğrenciyi ve Okulunu Çek
        const { data: student, error: fetchError } = await supabase
            .from('students')
            .select('id, school_id, wallet_balance')
            .eq('id', studentId)
            .single()

        if (fetchError || !student) {
            return { success: false, error: 'Öğrenci bulunamadı' }
        }

        // 3. Bakiyeyi Güncelle (Race Condition Riski Var - İdeal çözüm RPC kullanmaktır)
        // Şimdilik Server Action içinde yaparak Client manipülasyonunu engelliyoruz.
        const newBalance = (student.wallet_balance || 0) + amount

        const { error: updateError } = await supabase
            .from('students')
            .update({ wallet_balance: newBalance })
            .eq('id', studentId)

        if (updateError) throw updateError

        // 4. İşlem Kaydı Oluştur
        const { error: transactionError } = await supabase.from('transactions').insert({
            school_id: student.school_id,
            student_id: student.id,
            amount: amount,
            transaction_type: 'deposit',
            items_json: { note: 'Manuel Bakiye Yükleme (Admin)' }
        })

        if (transactionError) {
            console.error('Transaction Log Hatası:', transactionError)
            // Kritik değil, bakiye yüklendi ama log tutulamadı.
        }

        revalidatePath('/canteen/students')
        return { success: true, message: 'Bakiye başarıyla yüklendi.' }

    } catch (error: any) {
        console.error('Bakiye Yükleme Hatası:', error)
        return { success: false, error: error.message }
    }
}

export async function addStudent(formData: FormData) {
    const supabase = await createClient()

    const full_name = formData.get('full_name') as string
    const class_branch = formData.get('class_branch') as string
    const parent_name = formData.get('parent_name') as string
    const parent_phone = formData.get('parent_phone') as string
    const daily_limit = formData.get('daily_limit')
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
    const { error } = await supabase.from('students').insert({
        school_id: profile.school_id,
        full_name,
        class_branch,
        parent_name,
        parent_phone,
        daily_limit: Number(daily_limit) || 0,
        wallet_balance: 0,
        nfc_card_id: nfc_card_id || null,
    })

    if (error) {
        console.error('Ekleme Hatası:', error)
        return { success: false, error: error.message }
    }

    revalidatePath('/canteen/students')
    return { success: true }
}

export async function deleteStudent(studentId: string) {
    const supabase = await createClient()

    // 1. Önce bakiyeyi kontrol et
    const { data: student } = await supabase
        .from('students')
        .select('wallet_balance')
        .eq('id', studentId)
        .single()

    if (student && student.wallet_balance < 0) {
        return { success: false, error: 'Bu öğrencinin borcu var! Silmeden önce tahsilat yapmalısınız.' }
    }

    // 2. Silme işlemi
    const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', studentId)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/canteen/students')
    return { success: true }
}

export async function updateStudent(formData: FormData) {
    const supabase = await createClient()

    const id = formData.get('id') as string
    const nfc_card_id = formData.get('nfc_card_id') as string
    const daily_limit = formData.get('daily_limit')
    const parent_phone = formData.get('parent_phone') as string

    const { error } = await supabase
        .from('students')
        .update({
            nfc_card_id: nfc_card_id || null,
            daily_limit: Number(daily_limit) || 0,
            parent_phone
        })
        .eq('id', id)

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/canteen/students')
    return { success: true }
}
