-- SKM 工作日誌修正：
-- 1. 分類改為時間階段（開店前準備/營業中交接/閉店後清潔），以首個 checkpoint 為準
-- 2. 清掉 SKM 舊的 work_log_items（"確認出缺勤" 等殘留），讓下次員工進頁面時依新模板重建

-- Step 1: 清除 SKM 舊 items（包含所有日期的舊記錄；新 items 會在員工登入 /worklog 時自動建立）
DELETE FROM work_log_items
WHERE store_id = (SELECT id FROM stores WHERE name LIKE '%SKM%' LIMIT 1);

-- Step 2: 停用全部 SKM 舊模板（包含第一次 seed 進去但分類錯的那 43 筆）
UPDATE work_log_templates SET is_active = FALSE
WHERE store_id = (SELECT id FROM stores WHERE name LIKE '%SKM%' LIMIT 1) AND frequency = 'daily';

-- Step 3: 重新 seed SKM，分類用時間階段
INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active)
SELECT (SELECT id FROM stores WHERE name LIKE '%SKM%' LIMIT 1), v.cat, v.item, v.so, 'all', v.st, 'daily', v.cps::TEXT[], TRUE
FROM (VALUES
  ('開店前準備','出勤打卡',1,'opening','{morning_start,morning_end,evening_start,evening_end}'),
  ('開店前準備','早群組（SKM 美食現場回報群）報到',2,'opening','{morning_start}'),
  ('開店前準備','LG閨蜜機開機、網頁展示',3,'opening','{morning_start}'),
  ('開店前準備','盤點商品 回報公司群',4,'opening','{morning_start,evening_end}'),
  ('開店前準備','燈開/關（電燈、蛋糕櫃、展示LED燈）',5,'opening','{morning_start,evening_end}'),
  ('開店前準備','電視、音樂、閨蜜機開/關',6,'opening','{morning_start,evening_end}'),
  ('開店前準備','服裝儀容檢查（白上衣、長褲、包鞋、圍裙）',7,'opening','{morning_start,evening_start}'),
  ('開店前準備','咖啡機開/關機（確認有蒸氣後，轉緊蒸氣開關）',8,'opening','{morning_start,evening_end}'),
  ('開店前準備','iPad及百貨POS機開/關',9,'opening','{morning_start,evening_end}'),
  ('開店前準備','儲冰槽冰塊補充',10,'opening','{morning_start,evening_start}'),
  ('開店前準備','行銷活動確定',11,'opening','{morning_start,evening_start}'),
  ('開店前準備','抹布洗淨定位',12,'opening','{morning_start}'),
  ('開店前準備','咖啡磨豆機、奶泡機、氣炸鍋開/關',13,'opening','{morning_start,evening_end}'),
  ('開店前準備','工作吧台檯面擦拭（酒精）',14,'opening','{morning_start,evening_end}'),
  ('開店前準備','收銀機、蛋糕櫃檯面擦拭',15,'opening','{morning_start,evening_end}'),
  ('營業中交接','備貨單確認、檢查是否需叫貨、採買',16,'opening','{morning_end,evening_start}'),
  ('營業中交接','冰箱物料配置整理',17,'closing','{evening_start}'),
  ('開店前準備','茶湯、物料、備品數量檢查並填寫備貨表',18,'opening','{morning_start,evening_end}'),
  ('開店前準備','醬料瓶定位（檢查是否有異味）',19,'opening','{morning_start}'),
  ('開店前準備','器皿、器具定位',20,'opening','{morning_start,evening_end}'),
  ('開店前準備','補充外帶餐具、吸管、紙巾',21,'opening','{morning_start,evening_start}'),
  ('營業中交接','牛奶、茶湯、棕糖、裝飾水果檢查補充',22,'opening','{morning_end,evening_end}'),
  ('開店前準備','清點零用金是否為3000',23,'opening','{morning_start,evening_end}'),
  ('營業中交接','檢查錢櫃零錢量（下午換零錢）',24,'opening','{morning_end,evening_start}'),
  ('開店前準備','座位區桌椅定位靠攏、桌面擦拭',25,'opening','{morning_start,evening_end}'),
  ('閉店後清潔','烤箱、微波爐、氣炸鍋、鬆餅機清潔',26,'closing','{evening_end}'),
  ('閉店後清潔','咖啡機、磨豆機、奶泡機清洗',27,'closing','{evening_end}'),
  ('閉店後清潔','洗手台水槽清潔、更換濾網',28,'closing','{evening_end}'),
  ('閉店後清潔','掃地、拖地',29,'closing','{evening_end}'),
  ('閉店後清潔','倒垃圾，換上新垃圾袋',30,'closing','{evening_end}'),
  ('營業中交接','商品、層架除塵',31,'opening','{morning_end,evening_start}'),
  ('營業中交接','DM、文宣品、菜單整理歸位',32,'opening','{morning_end,evening_end}'),
  ('閉店後清潔','展示樣品檢查',33,'closing','{evening_end}'),
  ('閉店後清潔','抹布浸泡漂白水+洗碗精（接觸食材、一般用分開放）',34,'closing','{evening_end}'),
  ('閉店後清潔','所有器具電源關閉',35,'closing','{evening_end}'),
  ('營業中交接','餐具、杯盤擦拭歸位、定位、托盤洗乾淨晾乾',36,'opening','{morning_end,evening_end}'),
  ('閉店後清潔','檢查架上麵包效期、下架整理、key調撥退貨',37,'closing','{evening_end}'),
  ('閉店後清潔','所有冰箱門關妥、食材收納確實密封',38,'closing','{evening_end}'),
  ('閉店後清潔','清潔用品歸位',39,'closing','{evening_end}'),
  ('閉店後清潔','閨蜜機、iPad平板拔充電',40,'closing','{evening_end}'),
  ('閉店後清潔','關帳入金、小結紀錄、商品盤點POS輸入、群組回報',41,'closing','{evening_end}'),
  ('閉店後清潔','百貨閉店照（SKM 美食現場回報群）',42,'closing','{evening_end}'),
  ('開店前準備','離開前請記得，各冰箱門、燈類一定要巡過關好！',43,'opening','{morning_start,morning_end,evening_start,evening_end}')
) v(cat, item, so, st, cps)
WHERE (SELECT id FROM stores WHERE name LIKE '%SKM%' LIMIT 1) IS NOT NULL;
