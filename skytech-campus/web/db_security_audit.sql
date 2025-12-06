-- GÜVENLİK DENETİMİ VE İYİLEŞTİRMELER
-- Row Level Security (RLS) Politikaları ve Güvenlik Kontrolleri

-- ============================================
-- 1. SCHOOLS TABLOSU - RLS POLİTİKALARI GÜNCELLEME
-- ============================================
-- Mevcut politikaları kaldır (geliştirme için açık olanlar)
DROP POLICY IF EXISTS "Enable read access for all users" ON schools;
DROP POLICY IF EXISTS "Enable insert access for all users" ON schools;
DROP POLICY IF EXISTS "Enable update access for all users" ON schools;

-- Yeni güvenli politikalar
CREATE POLICY "Users can view their own school" ON schools FOR SELECT
USING (
    id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Only admins can create schools" ON schools FOR INSERT
WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can update their own school" ON schools FOR UPDATE
USING (
    id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 2. STUDENTS TABLOSU - RLS POLİTİKALARI GÜNCELLEME
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON students;
DROP POLICY IF EXISTS "Enable insert access for all users" ON students;
DROP POLICY IF EXISTS "Enable update access for all users" ON students;

CREATE POLICY "Users can view their school's students" ON students FOR SELECT
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can insert students for their school" ON students FOR INSERT
WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can update their school's students" ON students FOR UPDATE
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can delete their school's students" ON students FOR DELETE
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 3. TRANSACTIONS TABLOSU - RLS POLİTİKALARI GÜNCELLEME
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable update access for all users" ON transactions;

CREATE POLICY "Users can view their school's transactions" ON transactions FOR SELECT
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can insert transactions for their school" ON transactions FOR INSERT
WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Transactions güncelleme sadece iptal işlemleri için (POS'ta)
CREATE POLICY "Users can update their school's transactions" ON transactions FOR UPDATE
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Transactions silme sadece iptal işlemleri için
CREATE POLICY "Users can delete their school's transactions" ON transactions FOR DELETE
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 4. PRODUCTS TABLOSU - RLS POLİTİKALARI GÜNCELLEME
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON products;
DROP POLICY IF EXISTS "Enable insert access for all users" ON products;
DROP POLICY IF EXISTS "Enable update access for all users" ON products;

CREATE POLICY "Users can view their school's products" ON products FOR SELECT
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can insert products for their school" ON products FOR INSERT
WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can update their school's products" ON products FOR UPDATE
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can delete their school's products" ON products FOR DELETE
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 5. CANTEENS TABLOSU - RLS POLİTİKALARI GÜNCELLEME
-- ============================================
DROP POLICY IF EXISTS "Enable read access for all users" ON canteens;
DROP POLICY IF EXISTS "Enable insert access for all users" ON canteens;
DROP POLICY IF EXISTS "Enable update access for all users" ON canteens;

CREATE POLICY "Users can view their school's canteens" ON canteens FOR SELECT
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================
-- 6. PRIVACY_PIN GÜVENLİK KONTROLÜ
-- ============================================
-- PIN değiştirme işlemlerinde eski PIN kontrolü zorunlu
-- (Bu kontrol application layer'da yapılıyor, burada sadece not olarak bırakıyoruz)

-- ============================================
-- 7. AUDIT LOG TABLOSU (İsteğe bağlı - Gelecekte eklenebilir)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', etc.
    table_name TEXT,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON audit_logs(table_name, record_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON audit_logs FOR SELECT
USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

