-- 工作日誌雙班模式升級
-- 1. stores 新增 shift_mode：single（台北/屏東）或 double（左營/SKM）
-- 2. work_log_templates 新增 checkpoints：TEXT[] 支援多時段
--    single: {opening, during, closing} 任意組合
--    double: {morning_start, morning_end, evening_start, evening_end} 任意組合
-- 3. 初始化時若模板有 checkpoints 陣列，每個 checkpoint 建一筆 item（各自打勾）

ALTER TABLE stores ADD COLUMN IF NOT EXISTS shift_mode TEXT DEFAULT 'single';
ALTER TABLE work_log_templates ADD COLUMN IF NOT EXISTS checkpoints TEXT[];

-- 將現有模板的 shift_type 回填到 checkpoints（向後相容）
UPDATE work_log_templates
SET checkpoints = ARRAY[shift_type]
WHERE checkpoints IS NULL AND shift_type IS NOT NULL AND frequency = 'daily';

-- 設定雙班門市
UPDATE stores SET shift_mode = 'double' WHERE name LIKE '%SKM%' OR name LIKE '%新光左營%' OR name LIKE '%左營%';
-- SKM 每日工作矩陣種子資料
DO $$ DECLARE skm_id TEXT; BEGIN
  SELECT id INTO skm_id FROM stores WHERE name LIKE '%SKM%' LIMIT 1;
  IF skm_id IS NOT NULL THEN
    DELETE FROM work_log_templates WHERE store_id = skm_id AND frequency = 'daily';
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '出勤打卡', 1, 'all', 'opening', 'daily', '{morning_start,morning_end,evening_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '回報', '早群組（SKM 美食現場回報群 ）報到', 2, 'all', 'opening', 'daily', '{morning_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '設備維護', 'LG閨蜜機開機、網頁展示', 3, 'all', 'opening', 'daily', '{morning_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '食材管理', '盤點商品 回報公司群', 4, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '設備維護', '燈開/關（ 電燈、蛋糕櫃、展示LED燈）', 5, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '設備維護', '電視、音樂、閨蜜機開/關', 6, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '服務品質', '服裝儀容檢查(白上衣、長褲、包鞋、圍裙)', 7, 'all', 'opening', 'daily', '{morning_start,evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '設備維護', '咖啡機開/關機（確認有蒸氣後，轉緊蒸氣開關)', 8, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '設備維護', 'iPad及百貨pos機開/關', 9, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '食材管理', '儲冰槽冰塊補充', 10, 'all', 'opening', 'daily', '{morning_start,evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '行銷活動確定', 11, 'all', 'opening', 'daily', '{morning_start,evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '抹布洗淨定位', 12, 'all', 'opening', 'daily', '{morning_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '設備維護', '咖啡磨豆機、奶泡機、氣炸鍋開/關', 13, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '工作吧台檯面擦拭（酒精）', 14, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '收銀機、蛋糕櫃檯面擦拭', 15, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '食材管理', '備貨單確認、檢查是否需叫貨、採買', 16, 'all', 'opening', 'daily', '{morning_end,evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '冰箱物料配置整理', 17, 'all', 'closing', 'daily', '{evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '茶湯、物料、備品數量檢查並填寫備貨表', 18, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '醬料瓶定位（檢查是否有異味）', 19, 'all', 'opening', 'daily', '{morning_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '器皿、器具定位', 20, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '食材管理', '補充外帶餐具、吸管、紙巾', 21, 'all', 'opening', 'daily', '{morning_start,evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '食材管理', '牛奶、茶湯、棕糖、裝飾水果檢查補充', 22, 'all', 'opening', 'daily', '{morning_end,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '結算', '清點零用金是否為3000', 23, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '結算', '檢查錢櫃零錢量（下午換零錢）', 24, 'all', 'opening', 'daily', '{morning_end,evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '座位區桌椅定位靠攏、桌面擦拭', 25, 'all', 'opening', 'daily', '{morning_start,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '烤箱、微波爐、氣炸鍋、鬆餅機清潔', 26, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '咖啡機、磨豆機、奶泡機清洗', 27, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '洗手台水槽清潔、更換濾網', 28, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '掃地、拖地', 29, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '倒垃圾，換上新垃圾袋', 30, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '商品、層架除塵', 31, 'all', 'opening', 'daily', '{morning_end,evening_start}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', 'DM、文宣品、菜單整理歸位', 32, 'all', 'opening', 'daily', '{morning_end,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '展示樣品檢查', 33, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '抹布浸泡漂白水+洗碗精（接觸食材、一般用分開放）', 34, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '所有器具電源關閉', 35, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '餐具、杯盤擦拭歸位、定位、托盤洗乾淨晾乾', 36, 'all', 'opening', 'daily', '{morning_end,evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '檢查架上麵包效期、下架整理、key調撥退貨', 37, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '所有冰箱門關妥、食材收納確實密封', 38, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '清潔', '清潔用品歸位', 39, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '設備維護', '閨蜜機、iPad平板拔充電', 40, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '食材管理', '關帳入金、小結紀錄、商品盤點pos輸入、群組回報', 41, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '回報', '百貨閉店照（SKM 美食現場回報群 ）', 42, 'all', 'closing', 'daily', '{evening_end}', TRUE);
    INSERT INTO work_log_templates (store_id, category, item, sort_order, role, shift_type, frequency, checkpoints, is_active) VALUES (skm_id, '其他', '離開前請記得，各冰箱門、燈類一定要巡過關好！', 43, 'all', 'opening', 'daily', '{morning_start,morning_end,evening_start,evening_end}', TRUE);
  END IF;
END $$;
