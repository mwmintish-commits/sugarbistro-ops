建立 SQL 遷移檔案。

規則：
1. 所有 DDL 用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
2. 不要用 `DROP TABLE` 或 `DROP COLUMN`
3. 檔案存到 `migrations/` 目錄
4. 檔名格式：`YYYY-MM-DD-描述.sql`
5. 每個語句結尾加分號
6. 加註解說明每個改動
