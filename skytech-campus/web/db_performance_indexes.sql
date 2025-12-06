-- PERFORMANS OPTİMİZASYONU: DATABASE INDEX'LERİ
-- 100 okul, 50,000 öğrenci için optimize edilmiş index'ler

-- ============================================
-- 1. SCHOOLS TABLOSU
-- ============================================
CREATE INDEX IF NOT EXISTS idx_schools_is_active ON schools(is_active);
CREATE INDEX IF NOT EXISTS idx_schools_canteen_email ON schools(canteen_email) WHERE canteen_email IS NOT NULL;

-- ============================================
-- 2. STUDENTS TABLOSU (EN KRİTİK - 50,000 kayıt)
-- ============================================
-- school_id ile filtreleme çok sık yapılıyor
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id_active ON students(school_id, is_active) WHERE is_active = true;

-- NFC card ID ile arama (POS'ta çok sık kullanılıyor)
CREATE INDEX IF NOT EXISTS idx_students_nfc_card_id ON students(nfc_card_id) WHERE nfc_card_id IS NOT NULL;

-- Öğrenci numarası ile arama
CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number) WHERE student_number IS NOT NULL;

-- Composite index: school_id + nfc_card_id (POS sorguları için)
CREATE INDEX IF NOT EXISTS idx_students_school_nfc ON students(school_id, nfc_card_id) WHERE nfc_card_id IS NOT NULL;

-- ============================================
-- 3. TRANSACTIONS TABLOSU (ÇOK BÜYÜK - Milyonlarca kayıt olabilir)
-- ============================================
-- school_id ile filtreleme (en sık kullanılan)
CREATE INDEX IF NOT EXISTS idx_transactions_school_id ON transactions(school_id);

-- Tarih aralığı sorguları için (Dashboard'da çok kullanılıyor)
CREATE INDEX IF NOT EXISTS idx_transactions_school_created ON transactions(school_id, created_at DESC);

-- Transaction type ile filtreleme
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

-- Composite index: school_id + type + date (Dashboard sorguları için)
CREATE INDEX IF NOT EXISTS idx_transactions_school_type_date ON transactions(school_id, transaction_type, created_at DESC);

-- Student ID ile filtreleme (Öğrenci geçmişi için)
CREATE INDEX IF NOT EXISTS idx_transactions_student_id ON transactions(student_id) WHERE student_id IS NOT NULL;

-- Personnel ID ile filtreleme
CREATE INDEX IF NOT EXISTS idx_transactions_personnel_id ON transactions(personnel_id) WHERE personnel_id IS NOT NULL;

-- ============================================
-- 4. PRODUCTS TABLOSU
-- ============================================
-- school_id ile filtreleme
CREATE INDEX IF NOT EXISTS idx_products_school_id ON products(school_id);

-- Barcode ile arama (POS'ta çok sık kullanılıyor)
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;

-- Composite index: school_id + barcode (POS sorguları için)
CREATE INDEX IF NOT EXISTS idx_products_school_barcode ON products(school_id, barcode) WHERE barcode IS NOT NULL;

-- Stok kontrolü için
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(school_id, stock_quantity) WHERE stock_quantity < 10;

-- ============================================
-- 5. SUPPLIERS TABLOSU
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suppliers_school_id ON suppliers(school_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_school_name ON suppliers(school_id, name);

-- ============================================
-- 6. EXPENSES TABLOSU
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_school_id ON expenses(school_id);
CREATE INDEX IF NOT EXISTS idx_expenses_school_date ON expenses(school_id, expense_date DESC);

-- ============================================
-- 7. SCHOOL_PERSONNEL TABLOSU
-- ============================================
CREATE INDEX IF NOT EXISTS idx_personnel_school_id ON school_personnel(school_id);
CREATE INDEX IF NOT EXISTS idx_personnel_nfc_card_id ON school_personnel(nfc_card_id) WHERE nfc_card_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_personnel_school_nfc ON school_personnel(school_id, nfc_card_id) WHERE nfc_card_id IS NOT NULL;

-- ============================================
-- 8. ORDERS TABLOSU (Mobil siparişler)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_orders_school_id ON orders(school_id);
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id) WHERE student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_school_status ON orders(school_id, status, created_at DESC);

-- ============================================
-- 9. PROFILES TABLOSU (Authentication)
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON profiles(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================
-- 10. COMMISSION_RULES TABLOSU
-- ============================================
-- Zaten var: idx_commission_rules_price

-- ============================================
-- ANALİZ VE İSTATİSTİKLER
-- ============================================
-- Index kullanımını kontrol etmek için:
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY idx_scan DESC;

