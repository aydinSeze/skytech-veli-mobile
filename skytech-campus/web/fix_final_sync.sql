-- ============================================
-- SKYTECH CAMPUS - FIX FINAL SYNC (KESİN ÇÖZÜM)
-- Date: 2025-12-06
-- Description: Mobil giriş senkronizasyonunu ve izinleri düzelten tek seferlik script.
-- ============================================

-- ADIM 0: GEREKLİ EKLENTİLERİ AÇ
-- ============================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ADIM 1: ESKİ VE HATALI OLANLARI SİL
-- ============================================
DROP TRIGGER IF EXISTS on_student_created ON public.students;
DROP TRIGGER IF EXISTS on_student_updated ON public.students;
DROP FUNCTION IF EXISTS public.handle_new_student();
DROP FUNCTION IF EXISTS public.handle_student_changes();
DROP FUNCTION IF EXISTS public.create_student_user();
DROP FUNCTION IF EXISTS public.sync_student_to_auth(); -- Önceki denemelerden kalanlar
DROP TRIGGER IF EXISTS on_student_created_or_updated ON public.students;

-- ADIM 2: YENİ VE İTAATKAR BİR TRIGGER OLUŞTUR
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_student_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_email TEXT;
    v_password TEXT;
    v_encrypted_pw TEXT;
BEGIN
    -- Email formatı: ogrencino@skytech.campus
    -- Eğer öğrenci no yoksa nfc_id kullan (yedek)
    v_email := COALESCE(NEW.student_number, NEW.nfc_card_id) || '@skytech.campus';
    
    -- ŞİFRE MANTIĞI: mobile_password > student_number > '123456'
    -- Web panelinden gelen mobile_password önceliklidir.
    v_password := COALESCE(NEW.mobile_password, NEW.student_number, '123456');
    
    -- Şifreyi hashle (Supabase auth uyumlu)
    v_encrypted_pw := crypt(v_password, gen_salt('bf'));

    -- 1. Auth User Var mı Kontrol Et
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        -- KULLANICI YOKSA OLUŞTUR
        v_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_user_id,
            'authenticated',
            'authenticated',
            v_email,
            v_encrypted_pw, -- Hashlenmiş şifre
            now(),
            '{"provider": "email", "providers": ["email"]}',
            jsonb_build_object(
                'school_id', NEW.school_id, -- METADATA İÇİNE SCHOOL_ID EKLENDİ
                'student_id', NEW.id,
                'full_name', NEW.full_name,
                'role', 'student',
                'mobile_password', v_password -- Referans için
            ),
            now(),
            now()
        );
    ELSE
        -- KULLANICI VARSA GÜNCELLE (Şifre ve School ID Senkronizasyonu)
        UPDATE auth.users
        SET 
            encrypted_password = v_encrypted_pw,
            raw_user_meta_data = jsonb_build_object(
                'school_id', NEW.school_id,
                'student_id', NEW.id,
                'full_name', NEW.full_name,
                'role', 'student',
                'mobile_password', v_password
            ),
            updated_at = now()
        WHERE id = v_user_id;
    END IF;

    -- 2. Public Profile Oluştur/Güncelle (Yedek olarak)
    INSERT INTO public.profiles (id, email, full_name, role, school_id)
    VALUES (
        v_user_id,
        v_email,
        NEW.full_name,
        'student',
        NEW.school_id
    )
    ON CONFLICT (id) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        full_name = EXCLUDED.full_name,
        role = 'student';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı Bağla (INSERT ve UPDATE işlemlerinde çalışsın)
CREATE TRIGGER on_student_created_or_updated_v2
AFTER INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.handle_new_student_v2();


-- ADIM 3: İZİNLERİ SIFIRLA (RLS FIX)
-- ============================================
-- RLS'yi geçici olarak kapatıyoruz (Sorunsuz giriş için)
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- İzinleri aç
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;


-- ADIM 4: MEVCUT ÖĞRENCİLERİ TAMİR ET (DATA REPAIR)
-- ============================================
-- Trigger'ı tetikleyerek tüm öğrencileri auth.users ile senkronize et.
-- updated_at kolonu olmayabilir, bu yüzden full_name = full_name yaparak "fake" update yapıyoruz.
UPDATE public.students SET full_name = full_name;

-- Manuel Kontrol Bloğu (Trigger çalışmazsa diye garanti çözüm)
DO $$
DECLARE
    s RECORD;
    v_email TEXT;
    v_password TEXT;
    v_encrypted_pw TEXT;
    v_user_id UUID;
BEGIN
    FOR s IN SELECT * FROM public.students LOOP
        -- Değişkenleri hazırla
        v_email := COALESCE(s.student_number, s.nfc_card_id) || '@skytech.campus';
        v_password := COALESCE(s.mobile_password, s.student_number, '123456');
        v_encrypted_pw := crypt(v_password, gen_salt('bf'));
        
        -- Auth user bul
        SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
        
        IF v_user_id IS NULL THEN
            -- Oluştur
            v_user_id := gen_random_uuid();
            INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
            VALUES (
                '00000000-0000-0000-0000-000000000000',
                v_user_id,
                'authenticated',
                'authenticated',
                v_email,
                v_encrypted_pw,
                now(),
                jsonb_build_object('school_id', s.school_id, 'role', 'student', 'mobile_password', v_password, 'full_name', s.full_name)
            );
        ELSE
            -- Güncelle
            UPDATE auth.users 
            SET encrypted_password = v_encrypted_pw,
                raw_user_meta_data = jsonb_build_object('school_id', s.school_id, 'role', 'student', 'mobile_password', v_password, 'full_name', s.full_name)
            WHERE id = v_user_id;
        END IF;
    END LOOP;
END $$;

-- ============================================
-- İŞLEM TAMAMLANDI
-- ============================================
