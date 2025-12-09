-- ============================================
-- SKYTECH CAMPUS - KULLANICIYI ADMIN YAP
-- Email: aydinSezerr@outlook.com
-- ============================================

-- Önce kontrol et
SELECT 
    u.email,
    p.role,
    CASE 
        WHEN p.role = 'admin' THEN '✅ ZATEN ADMIN'
        WHEN p.role IS NULL THEN '❌ PROFİL YOK - Aşağıdaki sorguyu çalıştırın'
        ELSE '❌ ADMIN DEĞİL - Aşağıdaki sorguyu çalıştırın'
    END as durum
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'aydinSezerr@outlook.com';

-- Profil varsa güncelle
UPDATE public.profiles
SET role = 'admin'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'aydinSezerr@outlook.com'
)
AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id IN (SELECT id FROM auth.users WHERE email = 'aydinSezerr@outlook.com'));

-- Profil yoksa oluştur
INSERT INTO public.profiles (id, email, role, full_name)
SELECT 
    id,
    email,
    'admin' as role,
    COALESCE(raw_user_meta_data->>'full_name', 'Admin') as full_name
FROM auth.users
WHERE email = 'aydinSezerr@outlook.com'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
);

-- Sonucu kontrol et
SELECT 
    u.email,
    p.role,
    p.full_name,
    CASE 
        WHEN p.role = 'admin' THEN '✅ BAŞARILI - Artık kampanya ekleyebilirsiniz!'
        ELSE '❌ HATA - Tekrar deneyin'
    END as sonuc
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'aydinSezerr@outlook.com';


