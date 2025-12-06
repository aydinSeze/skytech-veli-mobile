-- 1. Okullar tablosuna 'system_credit' ekle (Varsayılan 0)
ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS system_credit NUMERIC DEFAULT 0;

-- 2. Admin Kredi Logları Tablosu
CREATE TABLE IF NOT EXISTS admin_credit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Politikaları (Admin her şeyi görür)
ALTER TABLE admin_credit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all credit logs" 
ON admin_credit_logs FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admin can insert credit logs" 
ON admin_credit_logs FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);
