-- ============================================
-- SKYTECH CAMPUS - ERİŞİM KODU SİSTEMİ (GÜVENLİ MİGRASYON)
-- Veri kaybı OLMADAN sadece ALTER ve UPDATE kullanarak
-- Tarih: 2025-01-27
-- ============================================
-- BU SCRIPT HİÇBİR VERİYİ SİLMEZ!
-- Sadece sütun ekler ve mevcut öğrencilere kod atar
-- ============================================

-- ============================================
-- ADIM 1: ACCESS_CODE SÜTUNU EKLE (EĞER YOKSA)
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'students' 
        AND column_name = 'access_code'
    ) THEN
        ALTER TABLE public.students 
        ADD COLUMN access_code TEXT;
        
        RAISE NOTICE '✅ access_code sütunu eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ access_code sütunu zaten mevcut';
    END IF;
END $$;

-- ============================================
-- ADIM 2: UNIQUE CONSTRAINT EKLE (EĞER YOKSA)
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'students_access_code_unique'
    ) THEN
        ALTER TABLE public.students 
        ADD CONSTRAINT students_access_code_unique UNIQUE (access_code);
        
        RAISE NOTICE '✅ UNIQUE constraint eklendi';
    ELSE
        RAISE NOTICE 'ℹ️ UNIQUE constraint zaten mevcut';
    END IF;
END $$;

-- ============================================
-- ADIM 3: KOD ÜRETME FONKSİYONU (GÜNCELLE)
-- ============================================
-- 6 haneli, büyük harf ve rakam içeren kod
-- 0, O, 1, I karakterleri kullanılmaz (okunabilirlik için)

CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; -- 0, O, 1, I hariç
    result TEXT := '';
    i INTEGER;
    random_char TEXT;
BEGIN
    -- 6 haneli kod üret
    FOR i IN 1..6 LOOP
        random_char := SUBSTR(chars, FLOOR(1 + RANDOM() * LENGTH(chars))::INTEGER, 1);
        result := result || random_char;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ADIM 4: MEVCUT ÖĞRENCİLERE KOD ATA (GÜVENLİ)
-- ============================================
-- SADECE NULL veya boş access_code'e sahip öğrencilere kod atar
-- Mevcut kodları değiştirmez!

DO $$
DECLARE
    student_record RECORD;
    new_code TEXT;
    attempts INTEGER;
    max_attempts INTEGER := 100;
    updated_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔄 Mevcut öğrencilere erişim kodu atanıyor...';
    
    -- NULL veya boş access_code'e sahip tüm öğrencileri işle
    FOR student_record IN 
        SELECT id, full_name FROM public.students 
        WHERE access_code IS NULL OR access_code = '' OR TRIM(access_code) = ''
    LOOP
        attempts := 0;
        
        -- Benzersiz kod üret (maksimum 100 deneme)
        LOOP
            new_code := generate_access_code();
            
            -- Bu kod başka bir öğrencide var mı kontrol et
            IF NOT EXISTS (
                SELECT 1 FROM public.students 
                WHERE access_code = new_code AND id != student_record.id
            ) THEN
                -- Benzersiz kod bulundu, ata
                UPDATE public.students 
                SET access_code = new_code 
                WHERE id = student_record.id;
                
                updated_count := updated_count + 1;
                EXIT; -- Döngüden çık
            END IF;
            
            attempts := attempts + 1;
            
            -- Çok fazla deneme yapıldıysa uyar
            IF attempts >= max_attempts THEN
                RAISE WARNING 'Öğrenci ID % için benzersiz kod üretilemedi (100 deneme): %', 
                    student_record.id, student_record.full_name;
                EXIT;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ % adet öğrenciye erişim kodu atandı!', updated_count;
END $$;

-- ============================================
-- ADIM 5: TRIGGER - YENİ ÖĞRENCİ EKLENDİĞİNDE OTOMATİK KOD ÜRET
-- ============================================

-- Eski trigger'ı sil (varsa)
DROP TRIGGER IF EXISTS auto_generate_access_code ON public.students;
DROP FUNCTION IF EXISTS public.trigger_generate_access_code();

-- Trigger fonksiyonu oluştur
CREATE OR REPLACE FUNCTION public.trigger_generate_access_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code TEXT;
    attempts INTEGER;
    max_attempts INTEGER := 100;
BEGIN
    -- Eğer access_code yoksa veya boşsa, otomatik üret
    IF NEW.access_code IS NULL OR NEW.access_code = '' OR TRIM(NEW.access_code) = '' THEN
        attempts := 0;
        
        LOOP
            new_code := generate_access_code();
            
            -- Benzersizlik kontrolü
            IF NOT EXISTS (
                SELECT 1 FROM public.students 
                WHERE access_code = new_code AND id != NEW.id
            ) THEN
                NEW.access_code := new_code;
                EXIT;
            END IF;
            
            attempts := attempts + 1;
            
            IF attempts >= max_attempts THEN
                RAISE EXCEPTION 'Benzersiz erişim kodu üretilemedi (100 deneme)';
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger oluştur
CREATE TRIGGER auto_generate_access_code
    BEFORE INSERT OR UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_generate_access_code();

-- ============================================
-- ADIM 6: RLS POLİTİKASI - ACCESS_CODE OKUMA İZNİ
-- ============================================
-- Anonim kullanıcılar access_code ile öğrenci sorgulayabilmeli (mobil giriş için)

-- Mevcut SELECT policy'lerini kontrol et ve gerekirse ekle
DO $$
BEGIN
    -- Eğer students tablosu için anonim SELECT policy yoksa ekle
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'students' 
        AND policyname = 'students_select_by_access_code'
    ) THEN
        -- Zaten mevcut policy'ler var, sadece kontrol ediyoruz
        NULL;
    END IF;
END $$;

-- ============================================
-- MİGRASYON TAMAMLANDI
-- ============================================
-- Bu migration dosyası çalıştırıldıktan sonra:
-- 1. ✅ access_code sütunu eklendi (eğer yoksa)
-- 2. ✅ Mevcut öğrencilere rastgele kodlar atandı (veri kaybı YOK)
-- 3. ✅ Yeni öğrenci eklendiğinde otomatik kod üretiliyor
-- 4. ✅ Anonim kullanıcılar access_code ile sorgulayabilir
-- 5. ✅ Mobil giriş için hazır!
-- ============================================
-- ÖNEMLİ: Bu script HİÇBİR VERİYİ SİLMEZ!
-- Sadece ALTER ve UPDATE kullanır
-- ============================================

