-- Round 12：總部代付 + 薪資

-- 新增總部代付分類
INSERT INTO expense_categories (name, type, sort_order) VALUES
('總部代付-租金', 'hq_advance', 20),
('總部代付-水電', 'hq_advance', 21),
('總部代付-保險', 'hq_advance', 22),
('總部代付-稅務', 'hq_advance', 23),
('總部代付-其他', 'hq_advance', 24)
ON CONFLICT (name) DO NOTHING;
