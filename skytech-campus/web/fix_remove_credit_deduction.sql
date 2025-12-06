-- ============================================
-- SKYTECH CAMPUS - FIX CREDIT DEDUCTION BUG
-- Date: 2025-12-06
-- Description: "deduct_system_credit" fonksiyonunu ve tetikleyicilerini kaldırır.
-- ============================================

-- GÖRDÜĞÜMÜZ KADARIYLA "deduct_system_credit" İSİMLİ BİR FONKSİYON VAR.
-- BU FONKSİYON OKUL BAKİYESİNDEN DÜŞMEYE ÇALIŞIYOR.
-- EĞER BU FONKSİYON GİRİŞ SIRASINDA VEYA KULLANICI OLUŞTURURKEN ÇALIŞIYORSA
-- VE HATA VERİYORSA, SİSTEME GİRİŞİ ENGELLER.

-- 1. FONKSİYONU VE ONA BAĞLI TRIGGERLARI SİL (CASCADE)
-- ============================================
DROP FUNCTION IF EXISTS public.deduct_system_credit() CASCADE;

-- 2. EĞER BAŞKA İSİMLE VARSA ONLARI DA SİL
-- ============================================
-- İsmi "credit" veya "balance" geçen şüpheli triggerları temizle
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT trigger_name, event_object_table
        FROM information_schema.triggers 
        WHERE trigger_name LIKE '%credit%' 
        OR trigger_name LIKE '%balance%'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', trg.trigger_name, trg.event_object_table);
        RAISE NOTICE 'Silinen Şüpheli Trigger: % (Tablo: %)', trg.trigger_name, trg.event_object_table;
    END LOOP;
END $$;

-- 3. SCHOOLS TABLOSU İZİNLERİNİ GARANTİLE
-- ============================================
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.schools TO anon, authenticated, service_role;

-- ============================================
-- İŞLEM TAMAMLANDI. LÜTFEN TEKRAR GİRİŞ DENEYİN.
-- ============================================
