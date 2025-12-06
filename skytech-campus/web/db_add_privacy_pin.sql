-- Add privacy_pin to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS privacy_pin text DEFAULT '0000';

-- Update existing records to have default pin
UPDATE schools SET privacy_pin = '0000' WHERE privacy_pin IS NULL;
