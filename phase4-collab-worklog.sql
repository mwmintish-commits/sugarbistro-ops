-- 協作式工作日誌

CREATE TABLE IF NOT EXISTS work_log_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) NOT NULL,
  date DATE NOT NULL,
  template_id UUID REFERENCES work_log_templates(id),
  item_name TEXT NOT NULL,
  category TEXT,
  shift_type TEXT DEFAULT 'opening',
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES employees(id),
  completed_by_name TEXT,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wli_store_date ON work_log_items(store_id, date);
ALTER TABLE work_log_items DISABLE ROW LEVEL SECURITY;
