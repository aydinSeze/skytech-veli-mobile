-- ============================================
-- SKYTECH CAMPUS - ÖĞRENCİ ÇEKME HATASI TESPİTİ
-- Console'da boş error objesi {} görünüyor - GERÇEK HATAYI BUL
-- ============================================

-- 1. MEVCUT RLS POLİTİKALARINI GÖR
-- ============================================
SELECT 
    policyname,
    cmd as command,
    qual as using_condition,
    with_check as with_check_condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'students'
ORDER BY policyname;

-- 2. RLS DURUMU
-- ============================================
SELECT 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'students';

-- 3. KULLANICI PROFİLİ KONTROLÜ
-- ============================================
-- Bu sorguyu çalıştırmadan önce, hangi kullanıcı ID'si ile giriş yaptığınızı bilmeniz gerekiyor
-- Console'da "👤 Kullanıcı ID: ..." logunu bulun ve aşağıdaki sorguda kullanın

-- ÖRNEK: Kullanıcı ID'si '123e4567-e89b-12d3-a456-426614174000' ise:
/*
SELECT 
    p.id,
    p.email,
    p.role,
    p.school_id,
    sch.name as school_name,
    COUNT(st.id) as student_count_in_school
FROM profiles p
LEFT JOIN schools sch ON sch.id = p.school_id
LEFT JOIN students st ON st.school_id = p.school_id
WHERE p.id = 'BURAYA_KULLANICI_ID_YAZIN'
GROUP BY p.id, p.email, p.role, p.school_id, sch.name;
*/

-- 4. RLS POLİTİKASI TESTİ (MANUEL)
-- ============================================
-- Aşağıdaki sorguyu Supabase SQL Editor'de authenticated kullanıcı olarak çalıştırın
-- Eğer 0 dönerse veya hata verirse, RLS politikası çalışıyor ama yanlış yapılandırılmış demektir

-- ÖRNEK: Okul ID'si '123e4567-e89b-12d3-a456-426614174000' ise:
/*
SELECT COUNT(*) 
FROM students 
WHERE school_id = 'BURAYA_OKUL_ID_YAZIN';
*/

-- 5. TÜM ÖĞRENCİLERİ GÖR (RLS OLMADAN - SADECE KONTROL İÇİN)
-- ============================================
-- Bu sorgu service role ile çalışır, RLS'i bypass eder
SELECT 
    st.id,
    st.full_name,
    st.school_id,
    sch.name as school_name,
    st.created_at
FROM students st
LEFT JOIN schools sch ON sch.id = st.school_id
ORDER BY st.created_at DESC
LIMIT 20;

-- 6. RLS POLİTİKASINI GEÇİCİ OLARAK KAPAT (TEST İÇİN)
-- ============================================
-- DİKKAT: Bu sadece test için! Production'da kapatmayın!
/*
ALTER TABLE students DISABLE ROW LEVEL SECURITY;
*/

-- Test ettikten sonra tekrar açın:
/*
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
*/

-- 7. DOĞRU RLS POLİTİKASI OLUŞTUR
-- ============================================
-- Eğer yukarıdaki testler RLS sorununu gösteriyorsa, bu politikayı çalıştırın:

-- Önce mevcut politikaları temizle
DROP POLICY IF EXISTS "Users can view their school's students" ON students;
DROP POLICY IF EXISTS "students_select_all_for_login" ON students;
DROP POLICY IF EXISTS "students_select_school_isolation" ON students;
DROP POLICY IF EXISTS "canteen_staff_view_own_school_students" ON students;
DROP POLICY IF EXISTS "canteen_staff_can_view_students" ON students;

-- YENİ POLİTİKA: Basit ve çalışan
CREATE POLICY "allow_canteen_staff_view_students"
ON students FOR SELECT
USING (
    -- Kullanıcının profile'ında school_id varsa ve öğrencinin school_id'si eşleşiyorsa
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
);

-- 8. İZİNLERİ KONTROL ET
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE students TO authenticated;

-- ============================================
-- SONUÇLARI KONTROL EDİN:
-- ============================================
-- 1. RLS açık mı? (rowsecurity = true)
-- 2. SELECT policy var mı?
-- 3. Policy condition doğru mu?
-- 4. Kullanıcının profile'ında school_id var mı?
-- 5. Öğrencilerin school_id'si doğru mu?
-- ============================================

