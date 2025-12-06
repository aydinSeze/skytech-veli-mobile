-- Orders table for student/parent orders from mobile app
CREATE TABLE IF NOT EXISTS orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    order_type TEXT NOT NULL DEFAULT 'mobile', -- 'mobile', 'supplier'
    items_json JSONB NOT NULL, -- Order items
    total_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'completed', 'cancelled'
    notes TEXT,
    completed_at TIMESTAMPTZ
);

-- Etüt günleri menüsü tablosu
CREATE TABLE IF NOT EXISTS etut_menu (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    menu_date DATE NOT NULL, -- Hangi gün için menü
    items_json JSONB NOT NULL, -- [{name: "Tost", price: 10}, ...]
    is_active BOOLEAN DEFAULT true,
    notification_sent BOOLEAN DEFAULT false -- Velilere bildirim gönderildi mi
);

-- RLS Policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE etut_menu ENABLE ROW LEVEL SECURITY;

-- Orders policies
CREATE POLICY "Users can view their school's orders" ON orders FOR SELECT
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can insert orders for their school" ON orders FOR INSERT
WITH CHECK (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can update their school's orders" ON orders FOR UPDATE
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Etut menu policies
CREATE POLICY "Users can view their school's etut menu" ON etut_menu FOR SELECT
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Users can manage their school's etut menu" ON etut_menu FOR ALL
USING (
    school_id IN (SELECT school_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orders_school_id ON orders(school_id);
CREATE INDEX IF NOT EXISTS idx_orders_student_id ON orders(student_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_etut_menu_school_id ON etut_menu(school_id);
CREATE INDEX IF NOT EXISTS idx_etut_menu_date ON etut_menu(menu_date);

