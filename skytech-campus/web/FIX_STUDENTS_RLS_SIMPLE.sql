-- ============================================
-- SKYTECH CAMPUS - ÖĞRENCİ GÖRÜNÜRLÜK BASİT ÇÖZÜM
-- RLS hatası devam ediyor - EN BASİT VE GARANTİLİ ÇÖZÜM
-- ============================================

-- ADIM 1: TÜM MEVCUT POLİTİKALARI SİL
-- ============================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'students'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.students', r.policyname);
    END LOOP;
END $$;

-- ADIM 2: RLS'İ GEÇİCİ OLARAK KAPAT (TEST İÇİN)
-- ============================================
-- DİKKAT: Bu sadece test için! Production'da dikkatli kullanın!
ALTER TABLE students DISABLE ROW LEVEL SECURITY;

-- ADIM 3: İZİNLERİ VER
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE students TO authenticated;
GRANT INSERT ON TABLE students TO authenticated;
GRANT UPDATE ON TABLE students TO authenticated;
GRANT DELETE ON TABLE students TO authenticated;

-- ============================================
-- TEST EDİN: Sayfayı yenileyin, öğrenciler görünmeli
-- ============================================
-- Eğer öğrenciler görünüyorsa, RLS sorunu doğrulandı.
-- Şimdi RLS'i tekrar açıp doğru politikayı oluşturalım:

-- ============================================
-- ADIM 4: RLS'İ TEKRAR AÇ VE DOĞRU POLİTİKAYI OLUŞTUR
-- ============================================
-- Yukarıdaki test başarılıysa, aşağıdaki kodu çalıştırın:

/*
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- BASİT VE ÇALIŞAN POLİTİKA
CREATE POLICY "allow_authenticated_view_students"
ON students FOR SELECT
USING (
    -- Authenticated kullanıcılar kendi okulunun öğrencilerini görebilir
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

CREATE POLICY "allow_authenticated_insert_students"
ON students FOR INSERT
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

CREATE POLICY "allow_authenticated_update_students"
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
);

CREATE POLICY "allow_authenticated_delete_students"
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
*/

-- ============================================
-- ÖNEMLİ NOTLAR:
-- ============================================
-- 1. Önce ADIM 1-3'ü çalıştırın (RLS'i kapat)
-- 2. Sayfayı yenileyin, öğrenciler görünmeli
-- 3. Eğer görünüyorsa, ADIM 4'ü çalıştırın (RLS'i aç + politika)
-- 4. Eğer hala görünmüyorsa, profile'da school_id yok demektir
-- ============================================

