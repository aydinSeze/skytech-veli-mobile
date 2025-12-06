-- ============================================
-- SKYTECH CAMPUS - TAM SİSTEM TARAMASI (DIAGNOSTIC REPORT)
-- Date: 2025-12-06
-- Description: Veritabanındaki her şeyi (Trigger, RLS, İzinler, Veri) raporlar.
-- ============================================

-- BU SCRIPT HİÇBİR ŞEYİ SİLMEZ VEYA DEĞİŞTİRMEZ.
-- SADECE MEVCUT DURUMU GÖSTERİR.
-- Lütfen sonuçları (Results) kopyalayıp bana gönderin.

-- 1. AUTH.USERS TRIGGERLARI (EN KRİTİK)
-- ============================================
SELECT 
    'AUTH TRIGGER' as type,
    trigger_name, 
    event_manipulation, 
    action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
AND event_object_schema = 'auth';

-- 2. STUDENTS VE PROFILES TRIGGERLARI
-- ============================================
SELECT 
    'TABLE TRIGGER' as type,
    event_object_table as table_name,
    trigger_name, 
    event_manipulation
FROM information_schema.triggers 
WHERE event_object_schema = 'public'
AND event_object_table IN ('students', 'profiles');

-- 3. RLS DURUMU VE POLİTİKALAR
-- ============================================
SELECT 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('students', 'profiles', 'schools');

SELECT 
    tablename, 
    policyname, 
    cmd as command, 
    qual as condition,
    with_check as check_condition
FROM pg_policies 
WHERE schemaname = 'public';

-- 4. SORUNLU KULLANICI DETAYLARI (319722)
-- ============================================
-- Auth tablosundaki durumu
SELECT 
    'AUTH USER' as source,
    id, 
    email, 
    encrypted_password, 
    raw_user_meta_data, 
    last_sign_in_at,
    created_at
FROM auth.users 
WHERE email LIKE '319722%';

-- Students tablosundaki durumu
SELECT 
    'STUDENT RECORD' as source,
    id, 
    student_number, 
    full_name, 
    school_id, 
    mobile_password
FROM public.students 
WHERE student_number = '319722';

-- Profiles tablosundaki durumu
SELECT 
    'PROFILE RECORD' as source,
    id, 
    email, 
    school_id, 
    role
FROM public.profiles 
WHERE email LIKE '319722%';

-- 5. FOREIGN KEY HATALARINI KONTROL ET
-- ============================================
-- Acaba school_id var ama schools tablosunda karşılığı yok mu?
SELECT 
    s.student_number, 
    s.school_id, 
    sch.id as school_table_id,
    CASE WHEN sch.id IS NULL THEN 'BOZUK (ORPHAN)' ELSE 'SAĞLAM' END as status
FROM public.students s
LEFT JOIN public.schools sch ON s.school_id = sch.id
WHERE s.student_number = '319722';

-- 6. PUBLIC FONKSİYONLAR
-- ============================================
SELECT 
    routine_name, 
    routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';

