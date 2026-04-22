-- 台北 / 屏東 / 左營 工作日誌模板 seed
-- 分類採時間階段：開店前準備 / 營業中交接 / 閉店後清潔
-- 台北/屏東 = 單班（opening/during/closing）
-- 左營 = 早晚雙班（morning_start/morning_end/evening_start/evening_end）
-- 做法：清掉該店 items + 停用舊 daily 模板 + 重新 seed

-- ========== 台北門市 ==========
DELETE FROM work_log_items
WHERE store_id = (SELECT id FROM stores WHERE name LIKE '%台北%' LIMIT 1);

UPDATE work_log_templates SET is_active = FALSE
WHERE store_id = (SELECT id FROM stores WHERE name LIKE '%台北%' LIMIT 1) AND frequency = 'daily';

INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active)
SELECT (SELECT id FROM stores WHERE name LIKE '%台北%' LIMIT 1), v.cat, v.item, v.so, 'all', v.st, 'daily', v.cps::TEXT[], TRUE
FROM (VALUES
  ('開店前準備','出勤打卡',1,'opening','{opening,during,closing}'),
  ('開店前準備','LINE 群組報到',2,'opening','{opening}'),
  ('開店前準備','燈/電視/音樂 開關',3,'opening','{opening,closing}'),
  ('開店前準備','服裝儀容檢查（白上衣、長褲、包鞋、圍裙）',4,'opening','{opening}'),
  ('開店前準備','咖啡機開/關機（確認蒸氣後關緊）',5,'opening','{opening,closing}'),
  ('開店前準備','咖啡磨豆機、奶泡機、氣炸鍋 開/關',6,'opening','{opening,closing}'),
  ('開店前準備','iPad / POS 機 開/關',7,'opening','{opening,closing}'),
  ('開店前準備','儲冰槽冰塊補充',8,'opening','{opening,during}'),
  ('開店前準備','抹布洗淨定位',9,'opening','{opening}'),
  ('開店前準備','工作吧台檯面擦拭（酒精）',10,'opening','{opening,closing}'),
  ('開店前準備','收銀機、蛋糕櫃檯面擦拭',11,'opening','{opening,closing}'),
  ('開店前準備','茶湯、物料、備品檢查（填備貨表）',12,'opening','{opening,closing}'),
  ('開店前準備','醬料瓶定位（檢查是否異味）',13,'opening','{opening}'),
  ('開店前準備','器皿、器具定位',14,'opening','{opening,closing}'),
  ('開店前準備','外帶餐具、吸管、紙巾補充',15,'opening','{opening,during}'),
  ('開店前準備','清點零用金是否為 3000',16,'opening','{opening,closing}'),
  ('開店前準備','座位區桌椅定位、桌面擦拭',17,'opening','{opening,closing}'),
  ('開店前準備','廚房食材檢查、烤箱預熱（內場）',18,'opening','{opening}'),
  ('營業中交接','備貨單確認、檢查叫貨/採買',19,'during','{during}'),
  ('營業中交接','牛奶、茶湯、棕糖、水果補充',20,'during','{during,closing}'),
  ('營業中交接','下午換零錢',21,'during','{during}'),
  ('營業中交接','商品、層架除塵',22,'during','{during}'),
  ('營業中交接','DM、菜單整理歸位',23,'during','{during,closing}'),
  ('營業中交接','餐具、杯盤擦拭歸位、托盤洗乾淨晾乾',24,'during','{during,closing}'),
  ('營業中交接','冰箱物料配置整理',25,'during','{during}'),
  ('閉店後清潔','烤箱、微波爐、氣炸鍋、鬆餅機清潔',26,'closing','{closing}'),
  ('閉店後清潔','咖啡機、磨豆機、奶泡機清洗',27,'closing','{closing}'),
  ('閉店後清潔','洗手台水槽清潔、更換濾網',28,'closing','{closing}'),
  ('閉店後清潔','掃地、拖地',29,'closing','{closing}'),
  ('閉店後清潔','倒垃圾、換新垃圾袋',30,'closing','{closing}'),
  ('閉店後清潔','廚房/內場清潔（內場）',31,'closing','{closing}'),
  ('閉店後清潔','抹布浸泡漂白水+洗碗精（接觸食材、一般用分開）',32,'closing','{closing}'),
  ('閉店後清潔','所有器具電源關閉',33,'closing','{closing}'),
  ('閉店後清潔','冰箱門關妥、食材密封',34,'closing','{closing}'),
  ('閉店後清潔','清潔用品歸位',35,'closing','{closing}'),
  ('閉店後清潔','關帳入金、小結紀錄、群組回報',36,'closing','{closing}'),
  ('閉店後清潔','離開前巡檢（燈、冰箱、門）',37,'closing','{opening,during,closing}')
) v(cat, item, so, st, cps)
WHERE (SELECT id FROM stores WHERE name LIKE '%台北%' LIMIT 1) IS NOT NULL;


-- ========== 屏東門市（台北清單 + 義大利麵） ==========
DELETE FROM work_log_items
WHERE store_id = (SELECT id FROM stores WHERE name LIKE '%屏東%' LIMIT 1);

UPDATE work_log_templates SET is_active = FALSE
WHERE store_id = (SELECT id FROM stores WHERE name LIKE '%屏東%' LIMIT 1) AND frequency = 'daily';

INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active)
SELECT (SELECT id FROM stores WHERE name LIKE '%屏東%' LIMIT 1), v.cat, v.item, v.so, 'all', v.st, 'daily', v.cps::TEXT[], TRUE
FROM (VALUES
  ('開店前準備','出勤打卡',1,'opening','{opening,during,closing}'),
  ('開店前準備','LINE 群組報到',2,'opening','{opening}'),
  ('開店前準備','燈/電視/音樂 開關',3,'opening','{opening,closing}'),
  ('開店前準備','服裝儀容檢查（白上衣、長褲、包鞋、圍裙）',4,'opening','{opening}'),
  ('開店前準備','咖啡機開/關機（確認蒸氣後關緊）',5,'opening','{opening,closing}'),
  ('開店前準備','咖啡磨豆機、奶泡機、氣炸鍋 開/關',6,'opening','{opening,closing}'),
  ('開店前準備','iPad / POS 機 開/關',7,'opening','{opening,closing}'),
  ('開店前準備','儲冰槽冰塊補充',8,'opening','{opening,during}'),
  ('開店前準備','抹布洗淨定位',9,'opening','{opening}'),
  ('開店前準備','工作吧台檯面擦拭（酒精）',10,'opening','{opening,closing}'),
  ('開店前準備','收銀機、蛋糕櫃檯面擦拭',11,'opening','{opening,closing}'),
  ('開店前準備','茶湯、物料、備品檢查（填備貨表）',12,'opening','{opening,closing}'),
  ('開店前準備','醬料瓶定位（檢查是否異味）',13,'opening','{opening}'),
  ('開店前準備','器皿、器具定位',14,'opening','{opening,closing}'),
  ('開店前準備','外帶餐具、吸管、紙巾補充',15,'opening','{opening,during}'),
  ('開店前準備','清點零用金是否為 3000',16,'opening','{opening,closing}'),
  ('開店前準備','座位區桌椅定位、桌面擦拭',17,'opening','{opening,closing}'),
  ('開店前準備','廚房食材檢查、烤箱預熱（內場）',18,'opening','{opening}'),
  ('開店前準備','義大利麵湯鍋預熱、醬料備料（內場）',19,'opening','{opening}'),
  ('營業中交接','備貨單確認、檢查叫貨/採買',20,'during','{during}'),
  ('營業中交接','牛奶、茶湯、棕糖、水果補充',21,'during','{during,closing}'),
  ('營業中交接','下午換零錢',22,'during','{during}'),
  ('營業中交接','商品、層架除塵',23,'during','{during}'),
  ('營業中交接','DM、菜單整理歸位',24,'during','{during,closing}'),
  ('營業中交接','餐具、杯盤擦拭歸位、托盤洗乾淨晾乾',25,'during','{during,closing}'),
  ('營業中交接','冰箱物料配置整理',26,'during','{during}'),
  ('閉店後清潔','烤箱、微波爐、氣炸鍋、鬆餅機清潔',27,'closing','{closing}'),
  ('閉店後清潔','咖啡機、磨豆機、奶泡機清洗',28,'closing','{closing}'),
  ('閉店後清潔','義大利麵鍋具深度清潔（內場）',29,'closing','{closing}'),
  ('閉店後清潔','洗手台水槽清潔、更換濾網',30,'closing','{closing}'),
  ('閉店後清潔','掃地、拖地',31,'closing','{closing}'),
  ('閉店後清潔','倒垃圾、換新垃圾袋',32,'closing','{closing}'),
  ('閉店後清潔','廚房/內場清潔（內場）',33,'closing','{closing}'),
  ('閉店後清潔','抹布浸泡漂白水+洗碗精（接觸食材、一般用分開）',34,'closing','{closing}'),
  ('閉店後清潔','所有器具電源關閉',35,'closing','{closing}'),
  ('閉店後清潔','冰箱門關妥、食材密封',36,'closing','{closing}'),
  ('閉店後清潔','清潔用品歸位',37,'closing','{closing}'),
  ('閉店後清潔','關帳入金、小結紀錄、群組回報',38,'closing','{closing}'),
  ('閉店後清潔','離開前巡檢（燈、冰箱、門）',39,'closing','{opening,during,closing}')
) v(cat, item, so, st, cps)
WHERE (SELECT id FROM stores WHERE name LIKE '%屏東%' LIMIT 1) IS NOT NULL;


-- ========== 新光左營（百貨、雙班、禮盒/麵包/泡芙餅乾） ==========
DELETE FROM work_log_items
WHERE store_id = (SELECT id FROM stores WHERE (name LIKE '%左營%' AND name NOT LIKE '%SKM%') LIMIT 1);

UPDATE work_log_templates SET is_active = FALSE
WHERE store_id = (SELECT id FROM stores WHERE (name LIKE '%左營%' AND name NOT LIKE '%SKM%') LIMIT 1) AND frequency = 'daily';

INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active)
SELECT (SELECT id FROM stores WHERE (name LIKE '%左營%' AND name NOT LIKE '%SKM%') LIMIT 1), v.cat, v.item, v.so, 'all', v.st, 'daily', v.cps::TEXT[], TRUE
FROM (VALUES
  ('開店前準備','出勤打卡',1,'opening','{morning_start,morning_end,evening_start,evening_end}'),
  ('開店前準備','早群組（百貨美食現場回報群）報到',2,'opening','{morning_start}'),
  ('開店前準備','LG 閨蜜機開機、網頁展示',3,'opening','{morning_start}'),
  ('開店前準備','盤點商品 回報公司群',4,'opening','{morning_start,evening_end}'),
  ('開店前準備','燈開/關（電燈、蛋糕櫃、LED）',5,'opening','{morning_start,evening_end}'),
  ('開店前準備','電視、音樂、閨蜜機 開/關',6,'opening','{morning_start,evening_end}'),
  ('開店前準備','服裝儀容檢查',7,'opening','{morning_start,evening_start}'),
  ('開店前準備','咖啡機開/關機',8,'opening','{morning_start,evening_end}'),
  ('開店前準備','iPad、百貨 POS 機 開/關',9,'opening','{morning_start,evening_end}'),
  ('開店前準備','儲冰槽冰塊補充',10,'opening','{morning_start,evening_start}'),
  ('開店前準備','行銷活動確定',11,'opening','{morning_start,evening_start}'),
  ('開店前準備','抹布洗淨定位',12,'opening','{morning_start}'),
  ('開店前準備','磨豆機、奶泡機、氣炸鍋 開/關',13,'opening','{morning_start,evening_end}'),
  ('開店前準備','工作吧台檯面擦拭（酒精）',14,'opening','{morning_start,evening_end}'),
  ('開店前準備','收銀機、蛋糕櫃檯面擦拭',15,'opening','{morning_start,evening_end}'),
  ('開店前準備','茶湯、物料、備品檢查（填備貨表）',16,'opening','{morning_start,evening_end}'),
  ('開店前準備','醬料瓶定位',17,'opening','{morning_start}'),
  ('開店前準備','器皿、器具定位',18,'opening','{morning_start,evening_end}'),
  ('開店前準備','外帶餐具、吸管、紙巾補充',19,'opening','{morning_start,evening_start}'),
  ('開店前準備','清點零用金 3000',20,'opening','{morning_start,evening_end}'),
  ('開店前準備','座位區桌椅定位、桌面擦拭',21,'opening','{morning_start,evening_end}'),
  ('開店前準備','禮盒陳列、效期檢查',22,'opening','{morning_start,evening_start}'),
  ('開店前準備','麵包上架、品項檢查',23,'opening','{morning_start}'),
  ('開店前準備','泡芙/餅乾製作、數量登記',24,'opening','{morning_start,morning_end}'),
  ('營業中交接','備貨單確認、檢查叫貨/採買',25,'during','{morning_end,evening_start}'),
  ('營業中交接','冰箱物料配置整理',26,'during','{evening_start}'),
  ('營業中交接','牛奶、茶湯、棕糖、水果補充',27,'during','{morning_end,evening_end}'),
  ('營業中交接','檢查錢櫃零錢量（下午換零錢）',28,'during','{morning_end,evening_start}'),
  ('營業中交接','商品、層架除塵',29,'during','{morning_end,evening_start}'),
  ('營業中交接','DM、文宣品、菜單整理歸位',30,'during','{morning_end,evening_end}'),
  ('營業中交接','餐具、杯盤擦拭歸位、托盤洗乾淨晾乾',31,'during','{morning_end,evening_end}'),
  ('閉店後清潔','烤箱、微波爐、氣炸鍋清潔',32,'closing','{evening_end}'),
  ('閉店後清潔','咖啡機、磨豆機、奶泡機清洗',33,'closing','{evening_end}'),
  ('閉店後清潔','洗手台水槽清潔、更換濾網',34,'closing','{evening_end}'),
  ('閉店後清潔','掃地、拖地',35,'closing','{evening_end}'),
  ('閉店後清潔','倒垃圾、換新垃圾袋',36,'closing','{evening_end}'),
  ('閉店後清潔','展示樣品檢查',37,'closing','{evening_end}'),
  ('閉店後清潔','抹布浸泡漂白水+洗碗精（分接觸食材/一般用）',38,'closing','{evening_end}'),
  ('閉店後清潔','所有器具電源關閉',39,'closing','{evening_end}'),
  ('閉店後清潔','檢查架上麵包效期、下架、key 調撥退貨',40,'closing','{evening_end}'),
  ('閉店後清潔','冰箱門關妥、食材密封',41,'closing','{evening_end}'),
  ('閉店後清潔','清潔用品歸位',42,'closing','{evening_end}'),
  ('閉店後清潔','閨蜜機、iPad 拔充電',43,'closing','{evening_end}'),
  ('閉店後清潔','關帳入金、小結紀錄、商品盤點 POS 輸入、群組回報',44,'closing','{evening_end}'),
  ('閉店後清潔','百貨閉店照（美食現場回報群）',45,'closing','{evening_end}'),
  ('閉店後清潔','離開前巡檢（冰箱、燈）',46,'closing','{morning_start,morning_end,evening_start,evening_end}')
) v(cat, item, so, st, cps)
WHERE (SELECT id FROM stores WHERE (name LIKE '%左營%' AND name NOT LIKE '%SKM%') LIMIT 1) IS NOT NULL;
