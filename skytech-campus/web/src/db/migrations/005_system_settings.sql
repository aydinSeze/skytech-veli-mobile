-- System Settings Tablosu (Komisyon Oranı ve Diğer Sistem Ayarları İçin)
CREATE TABLE IF NOT EXISTS system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key TEXT UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Politikaları
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Sadece admin okuyabilir ve güncelleyebilir
CREATE POLICY "Admin can view all settings" 
ON system_settings FOR SELECT 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admin can update all settings" 
ON system_settings FOR UPDATE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

CREATE POLICY "Admin can insert settings" 
ON system_settings FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Varsayılan komisyon oranını ekle (0.10 TL = 10 kuruş)
INSERT INTO system_settings (setting_key, setting_value, description)
VALUES ('commission_rate', '0.10', 'Her satıştan düşülecek komisyon oranı (TL cinsinden)')
ON CONFLICT (setting_key) DO NOTHING;

-- Updated_at için trigger
CREATE OR REPLACE FUNCTION update_system_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_settings_updated_at_trigger
    BEFORE UPDATE ON system_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_system_settings_updated_at();

