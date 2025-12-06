-- ============================================
-- SKYTECH CAMPUS - ÖĞRENCİ GÖRÜNÜRLÜK KONTROLÜ
-- Öğrenci sorgulama sekmesinde öğrencilerin kaybolma sorunu için diagnostic
-- ============================================

-- 1. RLS DURUMU KONTROLÜ
-- ============================================
SELECT 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'students';

-- 2. STUDENTS TABLOSU RLS POLİTİKALARI
-- ============================================
SELECT 
    policyname,
    cmd as command,
    qual as condition,
    with_check as check_condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'students'
ORDER BY policyname;

-- 3. MEVCUT ÖĞRENCİ SAYISI (OKUL BAZINDA)
-- ============================================
SELECT 
    sch.id as school_id,
    sch.name as school_name,
    COUNT(st.id) as student_count
FROM schools sch
LEFT JOIN students st ON st.school_id = sch.id
GROUP BY sch.id, sch.name
ORDER BY student_count DESC;

-- 4. PROFİLE'DA SCHOOL_ID OLMAYAN KULLANICILAR
-- ============================================
SELECT 
    p.id,
    p.email,
    p.role,
    p.school_id,
    CASE 
        WHEN p.school_id IS NULL THEN '❌ SCHOOL_ID YOK'
        ELSE '✅ OK'
    END as status
FROM profiles p
WHERE p.role IN ('canteen_staff', 'admin')
ORDER BY p.school_id NULLS FIRST;

-- 5. ÖĞRENCİLERİN SCHOOL_ID DURUMU
-- ============================================
SELECT 
    COUNT(*) as total_students,
    COUNT(CASE WHEN school_id IS NULL THEN 1 END) as null_school_id,
    COUNT(CASE WHEN school_id IS NOT NULL THEN 1 END) as has_school_id
FROM students;

-- 6. OKUL BAZINDA ÖĞRENCİ DAĞILIMI
-- ============================================
SELECT 
    sch.name as school_name,
    sch.id as school_id,
    COUNT(st.id) as student_count,
    COUNT(CASE WHEN st.is_active = true THEN 1 END) as active_students,
    COUNT(CASE WHEN st.is_active = false OR st.is_active IS NULL THEN 1 END) as inactive_students
FROM schools sch
LEFT JOIN students st ON st.school_id = sch.id
GROUP BY sch.id, sch.name
ORDER BY student_count DESC;

-- 7. KANTİN PERSONELİ VE OKUL EŞLEŞMESİ
-- ============================================
SELECT 
    p.id as profile_id,
    p.email,
    p.role,
    p.school_id as profile_school_id,
    sch.name as school_name,
    COUNT(st.id) as accessible_students
FROM profiles p
LEFT JOIN schools sch ON sch.id = p.school_id
LEFT JOIN students st ON st.school_id = p.school_id
WHERE p.role = 'canteen_staff'
GROUP BY p.id, p.email, p.role, p.school_id, sch.name
ORDER BY accessible_students DESC;

-- 8. RLS POLİTİKASI TESTİ (MANUEL KONTROL İÇİN)
-- ============================================
-- Bu sorguyu authenticated kullanıcı olarak çalıştırın:
-- SELECT COUNT(*) FROM students;
-- 
-- Eğer 0 dönerse, RLS politikası çalışıyor ama kullanıcının school_id'si eşleşmiyor demektir.
-- Eğer hata verirse, RLS politikası yanlış yapılandırılmış demektir.

-- 9. ÖNERİ: RLS POLİTİKASINI DÜZELTMEK İÇİN
-- ============================================
-- Eğer öğrenciler görünmüyorsa, aşağıdaki politikayı çalıştırın:

/*
-- Mevcut politikaları temizle
DROP POLICY IF EXISTS "Users can view their school's students" ON students;
DROP POLICY IF EXISTS "students_select_all_for_login" ON students;
DROP POLICY IF EXISTS "students_select_school_isolation" ON students;

-- Yeni politika: Kantin personeli kendi okulunun öğrencilerini görebilir
CREATE POLICY "canteen_staff_view_own_school_students"
ON students FOR SELECT
USING (
    -- Kantin personeli kendi okulunun öğrencilerini görebilir
    school_id IN (
        SELECT school_id 
        FROM profiles 
        WHERE id = auth.uid() 
        AND school_id IS NOT NULL
    )
    OR
    -- Admin her şeyi görebilir
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
    OR
    -- Anonim kullanıcılar access_code ile sorgulayabilir (mobil giriş için)
    auth.uid() IS NULL
);
*/

-- ============================================
-- SONUÇLARI KONTROL EDİN:
-- ============================================
-- 1. RLS açık mı? (rowsecurity = true olmalı)
-- 2. Politika var mı? (en az 1 SELECT policy olmalı)
-- 3. Profile'da school_id var mı? (canteen_staff için gerekli)
-- 4. Öğrencilerin school_id'si doğru mu?
-- 5. Okul bazında öğrenci sayısı doğru mu?
-- ============================================

