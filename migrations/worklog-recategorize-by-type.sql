-- 把工作日誌模板從「時間分類」改為「工作類型分類」
-- 依 item 名稱關鍵字優先順序自動歸類

UPDATE worklog_templates
SET category = CASE
  -- 財務（最具體，先判）
  WHEN item ~ '結帳|收銀|日結|存款|發票|找零|現金|對帳|入帳|押金|錢' THEN '💰 財務'

  -- 行政交接
  WHEN item ~ '報到|交接|儀容|服裝|簽到|簽退|班表|回報|公告|通知|站位|早會|晚會' THEN '📋 行政交接'

  -- 庫存補貨
  WHEN item ~ '盤點|叫貨|進貨|訂貨|庫存|補貨|月結|單據' THEN '🛒 庫存補貨'

  -- 備料（食材相關，但排除「補充冰塊」這類由設備觸發的雜項）
  WHEN item ~ '備料|食材|解凍|裝盤|烘焙|麵糊|糖漿|鮮奶|奶油|麵包|蛋糕|甜點|餅乾|泡芙' THEN '🍰 備料'
  WHEN item ~ '冰塊|儲冰' THEN '🍰 備料'

  -- 清潔
  WHEN item ~ '清潔|擦拭|清洗|抹布|拖地|洗淨|掃|垃圾|回收|廚餘|清空|消毒|擦|洗' THEN '🧹 清潔'

  -- 設備檢查（最寬鬆，最後判）
  WHEN item ~ '開機|關機|開/關|機|燈|POS|iPad|電視|音樂|閨蜜|空調|冷氣|溫度|電源|檢查|蒸氣|咖啡機|磨豆|奶泡|氣炸|烤箱|冰箱|冷藏|冷凍|展示櫃' THEN '⚙️ 設備檢查'

  ELSE '其他'
END
WHERE category IN ('開店前準備', '營業中交接', '閉店後清潔', '其他')
   OR category IS NULL;

-- 統計各分類數量（執行後可在 Supabase 看 NOTICE）
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT category, COUNT(*) AS n FROM worklog_templates GROUP BY category ORDER BY n DESC LOOP
    RAISE NOTICE '% : % 項', r.category, r.n;
  END LOOP;
END $$;
