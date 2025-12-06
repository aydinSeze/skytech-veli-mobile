-- Add credit_limit to students
ALTER TABLE students ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT 0;

-- Create school_personnel table
CREATE TABLE IF NOT EXISTS school_personnel (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  school_id uuid references schools(id) not null,
  full_name text not null,
  role text, -- 'Teacher', 'Staff', etc.
  nfc_card_id text unique,
  wallet_balance numeric default 0,
  credit_limit numeric default 0,
  is_active boolean default true
);

-- Enable RLS for school_personnel
ALTER TABLE school_personnel ENABLE ROW LEVEL SECURITY;

-- Policies for school_personnel
CREATE POLICY "Enable read access for all users" ON school_personnel FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON school_personnel FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON school_personnel FOR UPDATE USING (true);
