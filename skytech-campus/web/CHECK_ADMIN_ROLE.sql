-- ============================================
-- SKYTECH CAMPUS - ADMIN ROL KONTROLÜ
-- Kullanıcının admin olup olmadığını kontrol eder
-- ============================================

-- 1. MEVCUT KULLANICININ ROLÜNÜ KONTROL ET
-- ============================================
-- Aşağıdaki sorguyu çalıştırarak kendi email'inizi kontrol edin:
SELECT 
    u.id,
    u.email,
    p.role,
    p.full_name,
    CASE 
        WHEN p.role = 'admin' THEN '✅ ADMIN - Kampanya ekleyebilir'
        WHEN p.role IS NULL THEN '❌ PROFİL YOK - Profil oluşturulmalı'
        ELSE '❌ YETKİ YOK - Admin rolü gerekiyor'
    END as durum
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'BURAYA_EMAILINIZI_YAZIN'  -- Örn: 'aydinSezerr@outlook.com'
ORDER BY u.created_at DESC;

-- 2. KULLANICIYI ADMIN YAP
-- ============================================
-- Eğer yukarıdaki sorguda role 'admin' değilse, aşağıdaki sorguyu çalıştırın:
-- (Email'i kendi email'inizle değiştirin)

/*
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'BURAYA_EMAILINIZI_YAZIN'
);

-- Sonucu kontrol et
SELECT id, email, role FROM public.profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'BURAYA_EMAILINIZI_YAZIN');
*/

-- 3. EĞER PROFİL YOKSA OLUŞTUR
-- ============================================
-- Eğer yukarıdaki sorguda profil hiç yoksa (NULL), aşağıdaki sorguyu çalıştırın:

/*
INSERT INTO public.profiles (id, email, role, full_name)
SELECT 
    id,
    email,
    'admin' as role,
    COALESCE(raw_user_meta_data->>'full_name', 'Admin') as full_name
FROM auth.users
WHERE email = 'BURAYA_EMAILINIZI_YAZIN'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
);

-- Sonucu kontrol et
SELECT * FROM public.profiles 
WHERE id IN (SELECT id FROM auth.users WHERE email = 'BURAYA_EMAILINIZI_YAZIN');
*/

-- 4. TÜM ADMIN KULLANICILARI LİSTELE
-- ============================================
SELECT 
    u.email,
    p.role,
    p.full_name,
    u.created_at as kayit_tarihi
FROM auth.users u
INNER JOIN public.profiles p ON p.id = u.id
WHERE p.role = 'admin'
ORDER BY u.created_at DESC;

-- ============================================
-- SONUÇLARI KONTROL EDİN:
-- ============================================
-- 1. İlk sorguda kendi email'inizi kontrol edin
-- 2. Eğer role 'admin' değilse, 2. sorguyu çalıştırın
-- 3. Eğer profil yoksa, 3. sorguyu çalıştırın
-- 4. Sonra web panelini yenileyin (F5)
-- ============================================

