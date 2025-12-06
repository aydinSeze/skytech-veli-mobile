-- ============================================
-- SKYTECH CAMPUS - PROFILE SCHOOL_ID KONTROLÜ
-- Kullanıcının profile'ında school_id var mı kontrol et
-- ============================================

-- 1. TÜM KANTİN PERSONELİNİN PROFİLİNİ GÖR
-- ============================================
SELECT 
    p.id as user_id,
    p.email,
    p.role,
    p.school_id,
    sch.name as school_name,
    CASE 
        WHEN p.school_id IS NULL THEN '❌ SCHOOL_ID YOK - SORUN BURADA!'
        ELSE '✅ OK'
    END as status
FROM profiles p
LEFT JOIN schools sch ON sch.id = p.school_id
WHERE p.role IN ('canteen_staff', 'admin')
ORDER BY p.school_id NULLS FIRST;

-- 2. SCHOOL_ID OLMAYAN KULLANICILARI DÜZELT
-- ============================================
-- Eğer yukarıdaki sorguda school_id NULL olan kullanıcılar varsa,
-- aşağıdaki sorguyu çalıştırın (OKUL_ID'yi kendi okulunuzun ID'si ile değiştirin):

/*
-- ÖRNEK: Kullanıcı email'i 'kantin@example.com' ve okul ID'si '123e4567-e89b-12d3-a456-426614174000' ise:
UPDATE profiles 
SET school_id = 'BURAYA_OKUL_ID_YAZIN'
WHERE email = 'BURAYA_EMAIL_YAZIN'
AND school_id IS NULL;
*/

-- 3. KULLANICI BAZINDA ÖĞRENCİ SAYISI
-- ============================================
SELECT 
    p.id as user_id,
    p.email,
    p.role,
    p.school_id,
    sch.name as school_name,
    COUNT(st.id) as accessible_students
FROM profiles p
LEFT JOIN schools sch ON sch.id = p.school_id
LEFT JOIN students st ON st.school_id = p.school_id
WHERE p.role IN ('canteen_staff', 'admin')
GROUP BY p.id, p.email, p.role, p.school_id, sch.name
ORDER BY accessible_students DESC;

-- ============================================
-- SONUÇLARI KONTROL EDİN:
-- ============================================
-- 1. school_id NULL olan kullanıcı var mı?
-- 2. Varsa, yukarıdaki UPDATE sorgusunu çalıştırın
-- 3. Sonra sayfayı yenileyin
-- ============================================

