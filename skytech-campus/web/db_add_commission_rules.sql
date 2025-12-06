-- Komisyon Kuralları Tablosu (Fiyat Bazlı)
CREATE TABLE IF NOT EXISTS commission_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    min_price NUMERIC NOT NULL, -- Minimum fiyat (örn: 10 TL)
    max_price NUMERIC, -- Maximum fiyat (null ise sınırsız)
    commission_amount NUMERIC NOT NULL, -- Komisyon tutarı (örn: 0.10 TL = 10 kuruş)
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0 -- Öncelik (yüksek sayı = önce kontrol edilir)
);

-- RLS Policies
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

-- Sadece admin okuyabilir ve yönetebilir
CREATE POLICY "Admin can view commission rules" 
ON commission_rules FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admin can manage commission rules" 
ON commission_rules FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Index
CREATE INDEX IF NOT EXISTS idx_commission_rules_price ON commission_rules(min_price, max_price);

-- Varsayılan kurallar
INSERT INTO commission_rules (min_price, max_price, commission_amount, priority, is_active) VALUES
(0, 40, 0.10, 1, true), -- 0-40 TL arası: 10 kuruş
(41, 100, 0.20, 2, true), -- 41-100 TL arası: 20 kuruş
(101, NULL, 0.40, 3, true) -- 101 TL ve üzeri: 40 kuruş
ON CONFLICT DO NOTHING;

