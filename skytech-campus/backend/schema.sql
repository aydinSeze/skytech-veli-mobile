-- Create schools table
create table if not exists schools (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  address text,
  monthly_fee numeric default 0,
  canteen_email text,
  canteen_password text,
  is_active boolean default true,
  system_credit numeric default 0
);

-- Enable Row Level Security (RLS)
alter table schools enable row level security;

-- Create a policy that allows everyone to read/write for now (since we don't have auth fully set up yet)
-- WARNING: This is for development only. In production, we need proper policies.
create policy "Enable read access for all users" on schools for select using (true);
create policy "Enable insert access for all users" on schools for insert with check (true);
create policy "Enable update access for all users" on schools for update using (true);

-- Create canteens table
create table if not exists canteens (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  school_id uuid references schools(id) not null,
  is_active boolean default true
);

-- Enable RLS for canteens
alter table canteens enable row level security;

-- Policies for canteens
create policy "Enable read access for all users" on canteens for select using (true);
create policy "Enable insert access for all users" on canteens for insert with check (true);
create policy "Enable update access for all users" on canteens for update using (true);

-- Create products table
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  canteen_id uuid references canteens(id) not null,
  barcode text,
  buy_price numeric,
  sell_price numeric,
  stock integer default 0,
  is_active boolean default true
);

-- Enable RLS for products
alter table products enable row level security;

-- Policies for products
create policy "Enable read access for all users" on products for select using (true);
create policy "Enable insert access for all users" on products for insert with check (true);
create policy "Enable update access for all users" on products for update using (true);

-- Create transactions table
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  canteen_id uuid references canteens(id) not null,
  student_id uuid references students(id), -- Added student_id
  amount numeric not null,
  transaction_type text not null, -- 'purchase', 'refund', etc.
  items_json jsonb -- Store the cart items
);

-- Enable RLS for transactions
alter table transactions enable row level security;

-- Policies for transactions
create policy "Enable read access for all users" on transactions for select using (true);
create policy "Enable insert access for all users" on transactions for insert with check (true);
create policy "Enable update access for all users" on transactions for update using (true);

-- Create students table
create table if not exists students (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  school_id uuid references schools(id) not null,
  full_name text not null,
  student_number text,
  nfc_card_id text unique, -- NFC ID must be unique
  wallet_balance numeric default 0,
  is_active boolean default true
);

-- Enable RLS for students
alter table students enable row level security;

-- Policies for students
create policy "Enable read access for all users" on students for select using (true);
create policy "Enable insert access for all users" on students for insert with check (true);
create policy "Enable update access for all users" on students for update using (true);
