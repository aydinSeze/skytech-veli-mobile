'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getCommissionRate } from './admin-actions'

export async function refundTransaction(transactionId: string) {
    const supabase = await createClient()

    try {
        // 1. İşlem Detaylarını Çek
        const { data: transaction, error: fetchError } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', transactionId)
            .single()

        if (fetchError || !transaction) {
            return { success: false, error: 'İşlem bulunamadı.' }
        }

        // Sadece 'purchase' işlemleri iade edilebilir (Şimdilik)
        if (transaction.transaction_type !== 'purchase') {
            return { success: false, error: 'Sadece satış işlemleri iade edilebilir.' }
        }

        // 2. Bakiyeyi İade Et
        if (transaction.student_id) {
            const { data: student } = await supabase.from('students').select('wallet_balance').eq('id', transaction.student_id).single()
            if (student) {
                await supabase.from('students')
                    .update({ wallet_balance: student.wallet_balance + transaction.amount })
                    .eq('id', transaction.student_id)
            }
        } else if (transaction.personnel_id) {
            const { data: personnel } = await supabase.from('school_personnel').select('wallet_balance').eq('id', transaction.personnel_id).single()
            if (personnel) {
                await supabase.from('school_personnel')
                    .update({ wallet_balance: personnel.wallet_balance + transaction.amount })
                    .eq('id', transaction.personnel_id)
            }
        }

        // 2.5. Sistem Kredisinden Düşülen Komisyonu Geri Ekle (İade İşlemi)
        const commissionAmount = await getCommissionRate()
        if (transaction.school_id) {
            const { data: school } = await supabase
                .from('schools')
                .select('system_credit')
                .eq('id', transaction.school_id)
                .single()

            if (school) {
                const currentCredit = school.system_credit || 0
                const newCredit = currentCredit + commissionAmount // Geri ekle

                await supabase
                    .from('schools')
                    .update({ system_credit: newCredit })
                    .eq('id', transaction.school_id)

                console.log(`İade: Sistem komisyonu geri eklendi: ${commissionAmount} TL. Yeni kredi: ${newCredit} TL`)
            }
        }

        // 3. Stokları İade Et
        if (transaction.items_json && Array.isArray(transaction.items_json)) {
            for (const item of transaction.items_json) {
                if (item.id && item.quantity) {
                    // Mevcut stoku çek
                    const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.id).single()
                    if (product) {
                        const currentStock = product.stock_quantity || 0
                        await supabase.from('products')
                            .update({ stock_quantity: currentStock + item.quantity })
                            .eq('id', item.id)
                    }
                }
            }
        }

        // 4. İşlemi Sil (veya Status Güncelle)
        // Şimdilik siliyoruz, çünkü status kolonu olmayabilir.
        const { error: deleteError } = await supabase.from('transactions').delete().eq('id', transactionId)
        if (deleteError) throw deleteError

        revalidatePath('/canteen/pos')
        return { success: true, message: 'İade işlemi başarıyla tamamlandı.' }

    } catch (error: any) {
        console.error('İade Hatası:', error)
        return { success: false, error: error.message }
    }
}

// ---------------------------------------------------------
// 2. GÜVENLİ ÖDEME İŞLEMİ (Server-Side)
// ---------------------------------------------------------
export async function processPayment(cardId: string, cartItems: any[], userSchoolId: string, canteenId: string) {
    const supabase = await createClient()

    try {
        // 1. Müşteriyi Bul (Öğrenci veya Personel)
        let customer: any = null
        let customerType: 'student' | 'personnel' = 'student'

        // Önce Öğrenci
        const { data: student } = await supabase.from('students').select('*').eq('nfc_card_id', cardId).eq('school_id', userSchoolId).single()

        if (student) {
            customer = student
            customerType = 'student'
        } else {
            // Sonra Personel
            const { data: personnel } = await supabase.from('school_personnel').select('*').eq('nfc_card_id', cardId).eq('school_id', userSchoolId).single()
            if (personnel) {
                customer = personnel
                customerType = 'personnel'
            }
        }

        if (!customer) {
            return { success: false, error: 'Kart bulunamadı veya bu okula ait değil.' }
        }

        // 2. Sepet Tutarını Server Tarafında Tekrar Hesapla (Güvenlik İçin)
        let calculatedTotal = 0
        const verifiedCart = []

        for (const item of cartItems) {
            const { data: product } = await supabase.from('products').select('id, name, selling_price, stock_quantity').eq('id', item.id).single()

            if (!product) continue // Ürün silinmişse atla

            // Stok Kontrolü Kaldırıldı - Eksiye düşebilir
            // if (product.stock_quantity < item.quantity) {
            //     return { success: false, error: `Stok yetersiz: ${product.name} (Kalan: ${product.stock_quantity})` }
            // }

            calculatedTotal += product.selling_price * item.quantity
            verifiedCart.push({
                ...item,
                selling_price: product.selling_price, // Fiyatı DB'den al, client'tan değil!
                name: product.name
            })
        }

        if (verifiedCart.length === 0) {
            return { success: false, error: 'Sepet boş veya ürünler geçersiz.' }
        }

        // 3. Bakiye Kontrolü
        const currentBalance = customer.wallet_balance
        const creditLimit = customer.credit_limit || 0
        const newBalance = currentBalance - calculatedTotal

        if (newBalance < -creditLimit) {
            return {
                success: false,
                error: `Yetersiz Bakiye! Mevcut: ${currentBalance} TL, Limit: ${creditLimit} TL, Tutar: ${calculatedTotal} TL`
            }
        }

        // 4. Bakiyeyi Güncelle (ATOMİK İŞLEM - RPC)
        if (customerType === 'student') {
            const { error: rpcError } = await supabase.rpc('decrement_student_balance', {
                student_id: customer.id,
                amount: calculatedTotal
            })
            if (rpcError) throw rpcError
        } else {
            const { error: rpcError } = await supabase.rpc('decrement_personnel_balance', {
                personnel_id: customer.id,
                amount: calculatedTotal
            })
            if (rpcError) throw rpcError
        }

        // 5. Stokları Düş
        for (const item of verifiedCart) {
            // Burada race condition olabilir ama şimdilik kabul edilebilir.
            // İdeal çözüm: RPC ile stok düşmek.
            const { data: currentProd } = await supabase.from('products').select('stock_quantity').eq('id', item.id).single()
            if (currentProd) {
                await supabase.from('products')
                    .update({ stock_quantity: currentProd.stock_quantity - item.quantity })
                    .eq('id', item.id)
            }
        }

        // 6. Sistem Kredisinden Komisyon Düş (Fiyat Bazlı Kurallar)
        const { calculateCommission } = await import('@/actions/admin-actions')
        const commissionAmount = await calculateCommission(calculatedTotal) // Fiyat bazlı kurallara göre hesapla
        
        const { data: school, error: schoolError } = await supabase
            .from('schools')
            .select('system_credit')
            .eq('id', userSchoolId)
            .single()

        if (schoolError) {
            console.error('Okul kredisi çekilirken hata:', schoolError)
            // Hata olsa bile işleme devam et (kritik değil)
        } else if (school) {
            const currentCredit = school.system_credit || 0
            const newCredit = currentCredit - commissionAmount

            // Kredi negatif olsa bile düş (sistem komisyonu)
            const { error: updateError } = await supabase
                .from('schools')
                .update({ system_credit: newCredit })
                .eq('id', userSchoolId)

            if (updateError) {
                console.error('Sistem komisyonu düşülürken hata:', updateError)
                // Hata olsa bile işleme devam et (kritik değil)
            } else {
                console.log(`Sistem komisyonu düşüldü: ${commissionAmount} TL. Yeni kredi: ${newCredit} TL`)
            }
        }

        // 7. İşlemi Kaydet
        await supabase.from('transactions').insert([{
            canteen_id: canteenId || null,
            student_id: customerType === 'student' ? customer.id : null,
            personnel_id: customerType === 'personnel' ? customer.id : null,
            amount: calculatedTotal,
            transaction_type: 'purchase',
            items_json: verifiedCart,
            school_id: userSchoolId
        }])

        revalidatePath('/canteen/pos')
        revalidatePath('/canteen')
        return {
            success: true,
            message: 'Ödeme Başarılı!',
            newBalance: newBalance,
            totalAmount: calculatedTotal
        }

    } catch (error: any) {
        console.error('Ödeme Hatası:', error)
        return { success: false, error: error.message }
    }
}
