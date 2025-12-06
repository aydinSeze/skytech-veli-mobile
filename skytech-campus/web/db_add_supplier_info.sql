-- Add supplier info columns to products table
alter table public.products 
add column if not exists company_name text,
add column if not exists company_phone text;
