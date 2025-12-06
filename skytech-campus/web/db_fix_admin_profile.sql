-- BU SQL'İ SUPABASE SQL EDİTÖRÜNDE ÇALIŞTIRIN

-- 1. Önce mevcut profil varsa admin yapalım
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'aydinSezerr@outlook.com';

-- 2. Eğer profil hiç yoksa oluşturalım (Auth tablosundan çekerek)
INSERT INTO public.profiles (id, role, full_name, email)
SELECT id, 'admin', 'Aydin Sezer', email
FROM auth.users
WHERE email = 'aydinSezerr@outlook.com'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
);

-- 3. Sonucu görelim
SELECT * FROM public.profiles WHERE email = 'aydinSezerr@outlook.com';
