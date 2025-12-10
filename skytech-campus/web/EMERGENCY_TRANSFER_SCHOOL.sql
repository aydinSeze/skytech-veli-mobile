-- ============================================
-- SKYTECH CAMPUS - ACİL DURUM OKUL TRANSFERİ
-- ============================================
-- NASIL KULLANILIR?
-- 1. Aşağıdaki 'ESKI_ID_BURAYA' kısmına bozuk/kaynak okulun ID'sini yapıştırın.
-- 2. 'YENI_ID_BURAYA' kısmına yeni açtığınız okulun ID'sini yapıştırın.
-- 3. RUN butonuna basın.
-- ============================================

DO $$
DECLARE
    -- 👇 BURALARI DOLDURUN (Tırnakları silmeyin!)
    old_school_id uuid := 'ESKI_ID_BURAYA';
    new_school_id uuid := 'YENI_ID_BURAYA';
BEGIN
    -- 1. ÖĞRENCİLER
    UPDATE public.students 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 2. İŞLEMLER (Harcamalar)
    UPDATE public.transactions 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 3. SİPARİŞLER
    UPDATE public.orders 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 4. ÜRÜNLER
    UPDATE public.products 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 5. PERSONEL
    UPDATE public.school_personnel 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 6. ETÜT MENÜSÜ
    UPDATE public.etut_menu 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 7. KANTİNLER
    UPDATE public.canteens 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 8. TEDARİKÇİLER
    UPDATE public.suppliers 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    -- 9. GİDERLER
    UPDATE public.expenses 
    SET school_id = new_school_id 
    WHERE school_id = old_school_id;

    RAISE NOTICE 'Transfer başarıyla tamamlandı!';
END $$;
