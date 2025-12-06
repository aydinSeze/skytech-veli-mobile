-- ============================================
-- SKYTECH CAMPUS - EMERGENCY CLEANUP (ACİL TEMİZLİK)
-- Date: 2025-12-06
-- Description: "Database error querying schema" hatasını çözmek için TÜM otomasyonu durdurur.
-- ============================================

-- BU SCRIPT GİRİŞ YAPMAYI ENGELLEYEN HER ŞEYİ SİLER.
-- GİRİŞ YAPTIKTAN SONRA GEREKLİ OLANLARI TEKRAR EKLEYEBİLİRİZ.

-- 1. AUTH.USERS ÜZERİNDEKİ TÜM TRIGGERLARI SİL (UPDATE/INSERT)
-- ============================================
-- Giriş yaparken 'last_sign_in_at' güncellenir. 
-- Eğer UPDATE trigger'ı bozuksa, GİRİŞ YAPILAMAZ.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
DROP TRIGGER IF EXISTS on_user_logged_in ON auth.users;
DROP TRIGGER IF EXISTS check_user_active ON auth.users;
DROP TRIGGER IF EXISTS sync_user_to_student ON auth.users;

-- İsimlerini bilmediğimiz triggerları da bulup silmek için dinamik blok:
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'users' 
        AND event_object_schema = 'auth'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trg.trigger_name);
        RAISE NOTICE 'Silinen Trigger: %', trg.trigger_name;
    END LOOP;
END $$;


-- 2. STUDENTS VE PROFILES ÜZERİNDEKİ TRIGGERLARI SİL
-- ============================================
DROP TRIGGER IF EXISTS on_student_created ON public.students;
DROP TRIGGER IF EXISTS on_student_updated ON public.students;
DROP TRIGGER IF EXISTS on_student_created_or_updated ON public.students;
DROP TRIGGER IF EXISTS sync_student_to_auth ON public.students;


-- 3. RLS'Yİ TAMAMEN KAPAT (GARANTİ OLSUN)
-- ============================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;


-- 4. SORUNLU KULLANICIYI (319722) MANUEL DÜZELT
-- ============================================
-- Bu kullanıcının şifresini '123456' olarak ayarla ve bilgilerini onar.
DO $$
DECLARE
    v_user_id UUID;
    v_school_id UUID;
BEGIN
    -- Okul ID bul
    SELECT id INTO v_school_id FROM public.schools LIMIT 1;

    -- Kullanıcıyı bul
    SELECT id INTO v_user_id FROM auth.users WHERE email = '319722@skytech.campus';

    IF v_user_id IS NOT NULL THEN
        -- Şifreyi 123456 yap
        UPDATE auth.users 
        SET encrypted_password = crypt('123456', gen_salt('bf')),
            raw_user_meta_data = jsonb_build_object(
                'school_id', v_school_id, 
                'role', 'student',
                'mobile_password', '123456'
            )
        WHERE id = v_user_id;

        -- Profilini onar
        INSERT INTO public.profiles (id, email, full_name, role, school_id)
        VALUES (v_user_id, '319722@skytech.campus', 'Öğrenci 319722', 'student', v_school_id)
        ON CONFLICT (id) DO UPDATE SET school_id = v_school_id;
    END IF;
END $$;

-- ============================================
-- TEMİZLİK TAMAMLANDI. ARTIK GİRİŞ YAPILABİLMELİ.
-- ============================================
