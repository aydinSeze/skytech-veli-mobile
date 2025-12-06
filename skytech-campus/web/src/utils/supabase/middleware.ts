import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    )
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // IMPORTANT: Avoid writing any logic between createServerClient and
    // supabase.auth.getUser(). A simple mistake could make it very hard to debug
    // issues with users being randomly logged out.

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // 1. Giriş yapmamışsa ve korumalı alanlara gitmek istiyorsa -> Login'e yönlendir
    if (!user && (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/canteen'))) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
        return NextResponse.redirect(redirectUrl)
    }

    // 2. Giriş yapmışsa Rol Kontrolü Yap
    if (user) {
        // Hızlı admin kontrolü (email bazlı fallback)
        const isAdminEmail = user.email === 'admin@skytech.com' || user.email?.includes('admin')
        
        // Profil bilgisini çek
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        // Rol belirleme: Profil yoksa ama email admin ise admin say
        let userRole = profile?.role || (isAdminEmail ? 'admin' : 'student')

        // FALLBACK: Eğer profil çekilemediyse (RLS hatası vb.) ama email admin ise
        if (!profile && isAdminEmail) {
            userRole = 'admin'
        }

        // A) Login sayfasına gitmeye çalışıyorsa -> Panele yönlendir
        if (request.nextUrl.pathname === '/login') {
            const redirectUrl = request.nextUrl.clone()
            if (userRole === 'admin' || userRole === 'school_admin') {
                redirectUrl.pathname = '/dashboard'
            } else if (userRole === 'canteen_staff') {
                redirectUrl.pathname = '/canteen'
            } else {
                redirectUrl.pathname = '/'
            }
            redirectUrl.searchParams.delete('redirect')
            return NextResponse.redirect(redirectUrl)
        }

        // B) YETKİLENDİRME KURALLARI
        // 1. ADMIN: Tüm /dashboard rotalarına erişebilir
        if (userRole === 'admin' || userRole === 'school_admin') {
            // Admin için tüm dashboard rotalarına izin ver
            if (request.nextUrl.pathname.startsWith('/dashboard')) {
                return response
            }
            // Admin canteen'e de erişebilir
            return response
        }

        // 2. KANTİNCİ: Sadece /canteen rotalarına erişebilir
        if (userRole === 'canteen_staff') {
            if (request.nextUrl.pathname.startsWith('/dashboard')) {
                const redirectUrl = request.nextUrl.clone()
                redirectUrl.pathname = '/canteen'
                return NextResponse.redirect(redirectUrl)
            }
            // Canteen rotalarına izin ver
            if (request.nextUrl.pathname.startsWith('/canteen')) {
                return response
            }
        }

        // 3. DİĞERLERİ: Dashboard ve canteen rotalarına erişemez
        if (request.nextUrl.pathname.startsWith('/dashboard') || request.nextUrl.pathname.startsWith('/canteen')) {
            const redirectUrl = request.nextUrl.clone()
            redirectUrl.pathname = '/'
            return NextResponse.redirect(redirectUrl)
        }
    }

    return response
}
