import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { schoolName, schoolId, email: customEmail, password: customPassword } = body

        console.log('API Request Received:', { schoolName, schoolId, hasEmail: !!customEmail, hasPassword: !!customPassword })

        if (!schoolName || !schoolId) {
            return NextResponse.json({ error: 'Okul adı ve ID gereklidir.' }, { status: 400 })
        }

        // Service Role Key ile Admin Client oluştur
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        )

        // 1. E-posta ve Şifre Belirle
        let email = customEmail
        let password = customPassword

        if (!email || !password) {
            // Frontend göndermediyse otomatik oluştur (Fallback)
            const slug = schoolName
                .toLowerCase()
                .replace(/ğ/g, 'g')
                .replace(/ü/g, 'u')
                .replace(/ş/g, 's')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ç/g, 'c')
                .replace(/[^a-z0-9]/g, '')

            email = `kantin-${slug}@skytech.com`
            password = Math.floor(100000 + Math.random() * 900000).toString()
        }

        console.log('Credentials Generated:', { email, password })

        // 2. Kullanıcıyı Oluştur
        const { data: user, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        })

        if (createError) {
            console.error('Kullanıcı oluşturma hatası:', createError)
            return NextResponse.json({ error: 'Kullanıcı oluşturulamadı: ' + createError.message }, { status: 500 })
        }

        if (!user.user) {
            return NextResponse.json({ error: 'Kullanıcı nesnesi dönmedi.' }, { status: 500 })
        }

        console.log('User Created:', user.user.id)

        // 3. Profil Tablosunu Güncelle (Role ve School ID)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: user.user.id,
                email: email,
                full_name: schoolName + ' Kantin Sorumlusu',
                role: 'canteen_staff',
                school_id: schoolId
            })

        if (profileError) {
            console.error('Profil güncelleme hatası:', profileError)
        } else {
            console.log('Profile Updated')
        }

        // 4. Okul Tablosuna Bilgileri Kaydet (Göz butonu için)
        // KRİTİK GÜNCELLEME: BURASI KESİN ÇALIŞMALI
        console.log('Updating School Table for ID:', schoolId)
        const { error: schoolUpdateError } = await supabaseAdmin
            .from('schools')
            .update({ canteen_email: email, canteen_password: password })
            .eq('id', schoolId)

        if (schoolUpdateError) {
            console.error('Okul güncelleme hatası (şifre kaydedilemedi):', schoolUpdateError)
        } else {
            console.log('School Table Updated Successfully')
        }

        return NextResponse.json({ success: true, email, password })

    } catch (error: any) {
        console.error('API Hatası:', error)
        return NextResponse.json({ error: 'Sunucu hatası: ' + error.message }, { status: 500 })
    }
}
