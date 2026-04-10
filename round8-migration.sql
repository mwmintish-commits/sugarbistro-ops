-- Round 8：工作日誌 + 公布欄 + 費用系統 + 損益表

-- 工作日誌模板（每店的每日工作項目清單）
CREATE TABLE IF NOT EXISTS work_log_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 工作日誌紀錄
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES employees(id),
  store_id UUID REFERENCES stores(id),
  date DATE NOT NULL,
  items JSONB DEFAULT '[]',
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- 公布欄
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  store_id UUID,
  priority TEXT DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES employees(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 支出分類
CREATE TABLE IF NOT EXISTS expense_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 支出紀錄（月結廠商+零用金共用）
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id),
  category_id UUID REFERENCES expense_categories(id),
  expense_type TEXT NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  vendor_name TEXT,
  description TEXT,
  image_url TEXT,
  ai_raw_data JSONB,
  submitted_by UUID REFERENCES employees(id),
  status TEXT DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  month_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE work_log_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- 插入預設支出分類
INSERT INTO expense_categories (name, type, sort_order) VALUES
('食材原料', 'vendor', 1),
('包材耗材', 'vendor', 2),
('飲料原料', 'vendor', 3),
('清潔用品', 'vendor', 4),
('設備維修', 'vendor', 5),
('外送平台費', 'vendor', 6),
('其他廠商', 'vendor', 7),
('文具雜物', 'petty_cash', 10),
('交通費', 'petty_cash', 11),
('臨時採購', 'petty_cash', 12),
('維修零件', 'petty_cash', 13),
('其他零用', 'petty_cash', 14)
ON CONFLICT (name) DO NOTHING;

-- 插入預設工作日誌項目
INSERT INTO work_log_templates (store_id, category, item, sort_order) 
SELECT s.id, '開店準備', '確認冷藏冷凍溫度', 1 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '開店準備', '清潔工作檯面', 2 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '開店準備', '備料確認', 3 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '開店準備', '收銀機開機確認', 4 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '營業中', '隨時保持環境整潔', 10 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '營業中', '食材效期檢查', 11 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '營業中', '客人服務品質確認', 12 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '打烊作業', '清潔所有設備', 20 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '打烊作業', '垃圾清運', 21 FROM stores s WHERE s.name LIKE '%台北%'
UNION ALL SELECT s.id, '打烊作業', '鎖門確認', 22 FROM stores s WHERE s.name LIKE '%台北%'
ON CONFLICT DO NOTHING;
