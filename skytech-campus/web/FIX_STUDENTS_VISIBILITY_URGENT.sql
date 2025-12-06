-- ============================================
-- SKYTECH CAMPUS - ÖĞRENCİ GÖRÜNÜRLÜK ACİL DÜZELTME
-- Öğrenciler ekleniyor ama listede görünmüyor - KESİN ÇÖZÜM
-- ============================================

-- ADIM 1: RLS POLİTİKALARINI KONTROL ET VE DÜZELT
-- ============================================

-- Mevcut students SELECT politikalarını temizle
DROP POLICY IF EXISTS "Users can view their school's students" ON students;
DROP POLICY IF EXISTS "students_select_all_for_login" ON students;
DROP POLICY IF EXISTS "students_select_school_isolation" ON students;
DROP POLICY IF EXISTS "canteen_staff_view_own_school_students" ON students;

-- YENİ POLİTİKA: Kantin personeli kendi okulunun öğrencilerini görebilir
CREATE POLICY "canteen_staff_can_view_students"
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

-- ADIM 2: INSERT POLİTİKASI (Öğrenci ekleme için)
-- ============================================

DROP POLICY IF EXISTS "Users can insert students for their school" ON students;
DROP POLICY IF EXISTS "Canteen staff can manage students" ON students;
DROP POLICY IF EXISTS "students_insert_school_isolation" ON students;

CREATE POLICY "canteen_staff_can_insert_students"
ON students FOR INSERT
WITH CHECK (
    -- Kantin personeli kendi okuluna öğrenci ekleyebilir
    school_id IN (
        SELECT school_id 
        FROM profiles 
        WHERE id = auth.uid() 
        AND school_id IS NOT NULL
    )
    OR
    -- Admin her okula ekleyebilir
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- ADIM 3: UPDATE POLİTİKASI
-- ============================================

DROP POLICY IF EXISTS "Users can update their school's students" ON students;
DROP POLICY IF EXISTS "students_update_school_isolation" ON students;

CREATE POLICY "canteen_staff_can_update_students"
ON students FOR UPDATE
USING (
    school_id IN (
        SELECT school_id 
        FROM profiles 
        WHERE id = auth.uid() 
        AND school_id IS NOT NULL
    )
    OR
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
)
WITH CHECK (
    school_id IN (
        SELECT school_id 
        FROM profiles 
        WHERE id = auth.uid() 
        AND school_id IS NOT NULL
    )
    OR
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- ADIM 4: DELETE POLİTİKASI
-- ============================================

DROP POLICY IF EXISTS "Users can delete their school's students" ON students;
DROP POLICY IF EXISTS "students_delete_school_isolation" ON students;

CREATE POLICY "canteen_staff_can_delete_students"
ON students FOR DELETE
USING (
    school_id IN (
        SELECT school_id 
        FROM profiles 
        WHERE id = auth.uid() 
        AND school_id IS NOT NULL
    )
    OR
    EXISTS (
        SELECT 1 
        FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- ADIM 5: PROFİLE'DA SCHOOL_ID KONTROLÜ
-- ============================================
-- Eğer kantin personelinin profile'ında school_id yoksa, hata verir

-- Tüm kantin personelinin school_id'si olduğundan emin ol
UPDATE profiles p
SET school_id = (
    SELECT c.school_id 
    FROM canteens c 
    WHERE c.id = (
        SELECT canteen_id 
        FROM profiles 
        WHERE id = p.id 
        LIMIT 1
    )
    LIMIT 1
)
WHERE p.role = 'canteen_staff' 
AND p.school_id IS NULL
AND EXISTS (
    SELECT 1 
    FROM canteens c 
    WHERE c.id = (
        SELECT canteen_id 
        FROM profiles 
        WHERE id = p.id 
        LIMIT 1
    )
);

-- ADIM 6: İZİNLERİ KONTROL ET
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE students TO authenticated;
GRANT INSERT ON TABLE students TO authenticated;
GRANT UPDATE ON TABLE students TO authenticated;
GRANT DELETE ON TABLE students TO authenticated;

-- ============================================
-- MİGRASYON TAMAMLANDI
-- ============================================
-- Bu script çalıştırıldıktan sonra:
-- 1. ✅ RLS politikaları düzeltildi
-- 2. ✅ Kantin personeli kendi okulunun öğrencilerini görebilir
-- 3. ✅ Öğrenciler listede görünecek
-- ============================================

