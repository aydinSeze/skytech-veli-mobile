// Type definitions for Supabase tables
// Update these based on your actual database schema

export interface Student {
  id: string;
  email: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  student_id: string;
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  items: string;
  created_at: string;
  updated_at: string;
}

