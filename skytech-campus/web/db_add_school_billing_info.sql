-- Add billing and official information columns to schools table
-- For Sanal POS and Resmiyet (Official) infrastructure

ALTER TABLE schools 
ADD COLUMN IF NOT EXISTS iban text,
ADD COLUMN IF NOT EXISTS tax_office text,
ADD COLUMN IF NOT EXISTS tax_number text,
ADD COLUMN IF NOT EXISTS authorized_person text,
ADD COLUMN IF NOT EXISTS contact_phone text;

-- Comments for documentation
COMMENT ON COLUMN schools.iban IS 'IBAN number for payment processing (must start with TR)';
COMMENT ON COLUMN schools.tax_office IS 'Tax office name (Vergi Dairesi)';
COMMENT ON COLUMN schools.tax_number IS 'Tax number or TC number (Vergi No / T.C.)';
COMMENT ON COLUMN schools.authorized_person IS 'Authorized person full name (Yetkili Adı Soyadı)';
COMMENT ON COLUMN schools.contact_phone IS 'Contact phone number (Yetkili Telefonu)';

