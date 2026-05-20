"use client";
import { useState, useEffect } from "react";
import { compressImage, humanSize } from "../../lib/image-compress";
import { MONTHLY_VENDORS, HQ_ADVANCE_CATEGORIES } from "../../lib/expense-presets";

const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function UploadPage() {
  const [type, setType] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [expenseType, setExpenseType] = useState("vendor");
  const [photos, setPhotos] = useState([]); // [{ file, preview, name, base64, originalSize, compressedSize }]
  const [compressing, setCompressing] = useState(false);
  const [excelData, setExcelData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" });
  const [results, setResults] = useState([]); // 每張上傳完的結果（可內嵌編輯）
  const [done, setDone] = useState(false);

  // 月結 / 代付：使用者預選的廠商或類別
  const [presetVendor, setPresetVendor] = useState("");
  const [presetCategory, setPresetCategory] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const t = p.get("type") || "expense";
    setType(t);
    setStoreId(p.get("store_id") || "");
    setStoreName(decodeURIComponent(p.get("store_name") || ""));
    setEmpId(p.get("employee_id") || "");
    setEmpName(decodeURIComponent(p.get("employee_name") || ""));
    const et = p.get("expense_type") || "vendor";
    setExpenseType(et);
  }, []);

  const isExpense = type === "expense";
  const needsPreset = isExpense && (expenseType === "vendor" || expenseType === "hq_advance");
  const presetReady = !needsPreset || (expenseType === "vendor" ? !!presetVendor : !!presetCategory);

  const typeLabels = {
    settlement: "📊 日結單", deposit: "🏦 存款單",
    expense: expenseType === "petty_cash" ? "🪙 零用金收據" : expenseType === "hq_advance" ? "🏢 總部代付" : "📦 月結單據",
  };

  // 多張選照片 → 壓縮 → 加入清單
  const addPhotos = async (files) => {
    if (!files?.length) return;
    setCompressing(true);
    const arr = Array.from(files);
    const compressed = [];
    for (const f of arr) {
      try {
        const c = await compressImage(f);
        compressed.push({ file: f, name: f.name, ...c });
      } catch (e) {
        console.error("compress failed:", e);
        compressed.push({ file: f, name: f.name, error: e.message });
      }
    }
    setPhotos(prev => [...prev, ...compressed]);
    setCompressing(false);
  };

  const handleExcel = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      if (file.name.endsWith(".csv") || file.name.endsWith(".tsv")) {
        const lines = text.split("\n").filter(l => l.trim());
        const headers = lines[0].split(/[,\t]/).map(h => h.trim().replace(/"/g, ""));
        const rows = lines.slice(1).map(l => {
          const vals = l.split(/[,\t]/).map(v => v.trim().replace(/"/g, ""));
          const obj = {};
          headers.forEach((h, i) => obj[h] = vals[i] || "");
          return obj;
        });
        setExcelData({ headers, rows, filename: file.name });
      } else {
        alert("請上傳 CSV 檔案（Excel 請先另存為 CSV）");
      }
    };
    reader.readAsText(file);
  };

  const submitPhotos = async () => {
    if (photos.length === 0) { alert("請至少上傳一張照片"); return; }
    if (needsPreset && !presetReady) {
      alert(expenseType === "vendor" ? "請先選擇月結廠商" : "請先選擇代付類別");
      return;
    }
    setUploading(true);
    const allResults = [];
    for (let i = 0; i < photos.length; i++) {
      const ph = photos[i];
      if (ph.error || !ph.base64) {
        allResults.push({ index: i + 1, error: "圖片壓縮失敗", success: false });
        continue;
      }
      setProgress({ current: i + 1, total: photos.length, status: "上傳第 " + (i + 1) + " 張..." });
      try {
        // Step 1: 上傳圖片（已壓縮）
        const upRes = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: ph.base64, folder: type + "s",
            filename: storeId + "_" + Date.now() + "_" + i,
            ext: ph.ext, mimeType: ph.mimeType,
          }),
        }).then(r => r.json());

        // Step 2: AI 辨識 + 建草稿
        setProgress({ current: i + 1, total: photos.length, status: "辨識第 " + (i + 1) + " 張..." });
        const aiRes = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "analyze", type, base64: ph.base64,
            store_id: storeId, store_name: storeName,
            employee_id: empId, employee_name: empName,
            image_url: upRes.url, expense_type: expenseType,
            preset_vendor_name: needsPreset && expenseType === "vendor" ? presetVendor : null,
            preset_category: needsPreset && expenseType === "hq_advance" ? presetCategory : null,
          }),
        }).then(r => r.json());

        const ok = !aiRes.error && !!aiRes.draft_id;
        allResults.push({
          index: i + 1, image_url: upRes.url, ...aiRes, success: ok,
          // 給 UI 編輯用：填好的 form state
          form: {
            amount: aiRes.amount || "",
            vendor_name: aiRes.vendor_name || (needsPreset && expenseType === "vendor" ? presetVendor : ""),
            date: aiRes.date || new Date().toISOString().slice(0, 10),
            invoice_number: aiRes.invoice_number || "",
            category_suggestion: aiRes.category_suggestion || (needsPreset && expenseType === "hq_advance" ? presetCategory : "其他"),
            description: aiRes.description || "",
          },
          saved: false, finalized: false,
        });
      } catch (e) {
        allResults.push({ index: i + 1, error: e.message, success: false });
      }
    }
    setResults(allResults);
    setDone(true);
    setUploading(false);
  };

  const submitExcel = async () => {
    if (!excelData?.rows?.length) { alert("無資料"); return; }
    setUploading(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_csv", type, rows: excelData.rows, store_id: storeId, store_name: storeName, employee_id: empId, employee_name: empName, expense_type: expenseType }),
      }).then(r => r.json());
      setResults([{ success: true, imported: res.imported || 0, total: excelData.rows.length }]);
      setDone(true);
    } catch (e) { alert("匯入失敗：" + e.message); }
    setUploading(false);
  };

  // 更新單張結果的 form 欄位
  const updateResultForm = (idx, field, value) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, form: { ...r.form, [field]: value }, saved: false } : r));
  };

  // 儲存單張的修改（內嵌核對）
  const saveResult = async (idx) => {
    const r = results[idx];
    if (!r?.draft_id) return;
    const f = r.form;
    if (!f.amount || Number(f.amount) <= 0) { alert("請填寫金額"); return; }
    const res = await fetch("/api/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "quick_update_expense", draft_id: r.draft_id,
        amount: Number(f.amount), vendor_name: f.vendor_name, date: f.date,
        invoice_number: f.invoice_number, category_suggestion: f.category_suggestion,
        description: f.description,
      }),
    }).then(x => x.json());
    if (res.error) { alert("❌ " + res.error); return; }
    setResults(prev => prev.map((x, i) => i === idx ? { ...x, saved: true } : x));
  };

  // 送審單張（amount 必須 > 0）
  const finalizeResult = async (idx) => {
    const r = results[idx];
    if (!r?.draft_id) return;
    // 若有未儲存修改，先儲存
    if (!r.saved) await saveResult(idx);
    const res = await fetch("/api/upload", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "finalize_expense", draft_id: r.draft_id }),
    }).then(x => x.json());
    if (res.error) { alert("❌ " + res.error); return; }
    setResults(prev => prev.map((x, i) => i === idx ? { ...x, finalized: true } : x));
  };

  const finalizeAll = async () => {
    if (!confirm("確認所有單據都已核對正確？將一起送審")) return;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.success && r.draft_id && !r.finalized) {
        await finalizeResult(i);
      }
    }
  };

  // ===== 完成畫面（含內嵌編輯）=====
  if (done) {
    const isExpenseResults = type === "expense" && results.some(r => r.draft_id);
    const allFinalized = isExpenseResults && results.every(r => !r.draft_id || r.finalized);
    const anyDraft = isExpenseResults && results.some(r => r.draft_id && !r.finalized);
    return (
      <Box>
        <div style={{ fontSize: 36, textAlign: "center" }}>{allFinalized ? "✅" : "📝"}</div>
        <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 12 }}>
          {typeLabels[type]}：{allFinalized ? "全部已送審" : "請核對下方資料"}
        </div>

        {results.map((r, idx) => {
          if (!r.draft_id || !r.success) {
            return (
              <div key={idx} style={{ background: r.error ? "#fde8e8" : "#e6f9f0", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>
                  {r.imported !== undefined ? `📊 匯入 ${r.imported}/${r.total} 筆` : `第 ${r.index} 張`}
                </div>
                {r.error && <div style={{ color: "#b91c1c" }}>❌ {r.error}</div>}
                {!r.error && r.success && <div style={{ color: "#0a7c42" }}>✅ 完成</div>}
              </div>
            );
          }
          // expense 內嵌編輯卡片
          const f = r.form;
          const needsFix = !f.amount || Number(f.amount) <= 0;
          return (
            <div key={idx} style={{
              background: r.finalized ? "#e6f9f0" : needsFix ? "#fef3c7" : "#fff",
              border: "1px solid " + (r.finalized ? "#0a7c42" : needsFix ? "#f59e0b" : "#e8e6e1"),
              borderRadius: 10, padding: 10, marginBottom: 10
            }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <img src={r.image_url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #eee" }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600 }}>
                    第 {r.index} 張 {r.finalized && <span style={{ color: "#0a7c42" }}>✓ 已送審</span>}
                    {needsFix && !r.finalized && <span style={{ color: "#b45309" }}> ⚠️ 需填金額</span>}
                  </div>
                  <a href={r.image_url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "#4361ee" }}>🔍 看原檔</a>
                </div>
              </div>
              {!r.finalized && (
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 6px", fontSize: 11 }}>
                  <label style={lbl}>💰 金額</label>
                  <input type="number" inputMode="decimal" value={f.amount} onChange={e => updateResultForm(idx, "amount", e.target.value)} style={{ ...inp, fontWeight: 700, color: "#0a7c42", fontSize: 14, textAlign: "right" }} />

                  <label style={lbl}>🏢 廠商</label>
                  <input value={f.vendor_name} onChange={e => updateResultForm(idx, "vendor_name", e.target.value)} style={inp} />

                  <label style={lbl}>📅 日期</label>
                  <input type="date" value={f.date} onChange={e => updateResultForm(idx, "date", e.target.value)} style={inp} />

                  <label style={lbl}>🧾 發票</label>
                  <input value={f.invoice_number} onChange={e => updateResultForm(idx, "invoice_number", e.target.value)} placeholder="AB-12345678" style={inp} />

                  <label style={lbl}>📁 分類</label>
                  <select value={f.category_suggestion} onChange={e => updateResultForm(idx, "category_suggestion", e.target.value)} style={inp}>
                    {[...new Set(["食材原料","包材耗材","飲料原料","清潔用品","設備維修","租金","水電費","瓦斯費","電信費","廣告行銷","印刷費","員工餐費","其他", ...HQ_ADVANCE_CATEGORIES])].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {!r.finalized && (
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => saveResult(idx)} disabled={needsFix} style={btn(r.saved ? "#888" : "#4361ee", needsFix)}>
                    {r.saved ? "✓ 已儲存" : "💾 暫存修改"}
                  </button>
                  <button onClick={() => finalizeResult(idx)} disabled={needsFix} style={btn("#0a7c42", needsFix)}>
                    ✅ 送審
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {anyDraft && (
          <button onClick={finalizeAll} style={{ width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#0a7c42", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
            ✅ 全部送審
          </button>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => { setResults([]); setPhotos([]); setDone(false); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 12, cursor: "pointer" }}>
            📷 繼續上傳
          </button>
          <button onClick={() => { window.close(); }} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ddd", background: "#fff", fontSize: 12, cursor: "pointer" }}>
            🚪 完成關閉
          </button>
        </div>
      </Box>
    );
  }

  // ===== 上傳畫面 =====
  return (
    <Box>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{typeLabels[type] || "📸 上傳"}</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{storeName} {empName ? "— " + empName : ""}</div>

      {/* 月結／代付：先選廠商/類別 */}
      {isExpense && expenseType === "vendor" && (
        <div style={{ background: "#dbeafe", borderRadius: 8, padding: 10, marginBottom: 12, border: presetVendor ? "1px solid #1d4ed8" : "2px solid #f59e0b" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", marginBottom: 6 }}>
            📦 月結廠商 {!presetVendor && <span style={{ color: "#b45309" }}>← 請先選擇</span>}
          </div>
          <select value={presetVendor} onChange={e => setPresetVendor(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}>
            <option value="">-- 選擇月結廠商 --</option>
            {MONTHLY_VENDORS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}
      {isExpense && expenseType === "hq_advance" && (
        <div style={{ background: "#e0e7ff", borderRadius: 8, padding: 10, marginBottom: 12, border: presetCategory ? "1px solid #4338ca" : "2px solid #f59e0b" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#4338ca", marginBottom: 6 }}>
            🏢 代付類別 {!presetCategory && <span style={{ color: "#b45309" }}>← 請先選擇</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
            {HQ_ADVANCE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setPresetCategory(c)} type="button"
                style={{
                  padding: "8px 4px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                  border: presetCategory === c ? "2px solid #4338ca" : "1px solid #ddd",
                  background: presetCategory === c ? "#4338ca" : "#fff",
                  color: presetCategory === c ? "#fff" : "#666",
                  fontWeight: presetCategory === c ? 600 : 400,
                }}>{c}</button>
            ))}
          </div>
        </div>
      )}

      {/* 模式切換 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <button onClick={() => setExcelData(null)} style={{ flex: 1, padding: 8, borderRadius: 8, border: !excelData ? "2px solid #1a1a1a" : "1px solid #ddd", background: !excelData ? "#1a1a1a" : "#fff", color: !excelData ? "#fff" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>📸 拍照上傳</button>
        <button onClick={() => setPhotos([])} style={{ flex: 1, padding: 8, borderRadius: 8, border: excelData ? "2px solid #1a1a1a" : "1px solid #ddd", background: excelData ? "#1a1a1a" : "#fff", color: excelData ? "#fff" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
          <label style={{ cursor: "pointer" }}>📊 Excel/CSV
            <input type="file" accept=".csv,.tsv,.xlsx" onChange={e => { if (e.target.files[0]) handleExcel(e.target.files[0]); }} style={{ display: "none" }} />
          </label>
        </button>
      </div>

      {/* 照片模式 */}
      {!excelData && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 8 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #eee", aspectRatio: "1" }}>
              <img src={p.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, cursor: "pointer" }}>✕</button>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 9, padding: "2px 4px", textAlign: "center" }}>
                {humanSize(p.originalSize)} → {humanSize(p.compressedSize)}
              </div>
            </div>
          ))}
          <label style={{ borderRadius: 8, border: "2px dashed #ccc", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#faf8f5" }}>
            <div style={{ fontSize: 28, color: "#ccc" }}>+</div>
            <div style={{ fontSize: 10, color: "#888" }}>選多張</div>
            <input type="file" accept="image/*,application/pdf" multiple onChange={e => addPhotos(e.target.files)} style={{ display: "none" }} />
          </label>
          <label style={{ borderRadius: 8, border: "2px dashed #ccc", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#faf8f5" }}>
            <div style={{ fontSize: 28, color: "#ccc" }}>📷</div>
            <div style={{ fontSize: 10, color: "#888" }}>拍照</div>
            <input type="file" accept="image/*" capture="environment" onChange={e => addPhotos(e.target.files)} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ fontSize: 10, color: "#888", textAlign: "center", marginBottom: 8 }}>
          {compressing && "壓縮中..."}
          {!compressing && photos.length > 0 && `已選 ${photos.length} 張（自動壓縮為長邊 ≤ 1600px）`}
          {!compressing && photos.length === 0 && "支援多張，每張會獨立辨識並可內嵌修正"}
        </div>
        <button onClick={submitPhotos} disabled={uploading || compressing || photos.length === 0 || (needsPreset && !presetReady)}
          style={{ width: "100%", padding: 14, borderRadius: 8, border: "none",
            background: (photos.length === 0 || (needsPreset && !presetReady) || compressing) ? "#ddd" : uploading ? "#888" : "#0a7c42",
            color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {uploading ? `⏳ ${progress.status}（${progress.current}/${progress.total}）` :
           compressing ? "⏳ 圖片壓縮中..." :
           needsPreset && !presetReady ? (expenseType === "vendor" ? "請先選廠商" : "請先選類別") :
           `📤 上傳 ${photos.length} 張並辨識`}
        </button>
      </>}

      {/* Excel/CSV 模式 */}
      {excelData && <>
        <div style={{ background: "#faf8f5", borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>📊 {excelData.filename}</div>
          <div style={{ fontSize: 11, color: "#888", marginBottom: 8 }}>共 {excelData.rows.length} 筆資料</div>
          <div style={{ maxHeight: 200, overflow: "auto", borderRadius: 6, border: "1px solid #eee" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead><tr style={{ background: "#e6f1fb" }}>{excelData.headers.slice(0, 6).map(h => <th key={h} style={{ padding: 4, textAlign: "left", fontWeight: 500 }}>{h}</th>)}</tr></thead>
              <tbody>{excelData.rows.slice(0, 10).map((r, i) => <tr key={i} style={{ borderBottom: "1px solid #f0f0f0" }}>{excelData.headers.slice(0, 6).map(h => <td key={h} style={{ padding: 3 }}>{r[h] || ""}</td>)}</tr>)}</tbody>
            </table>
            {excelData.rows.length > 10 && <div style={{ padding: 4, fontSize: 10, color: "#888", textAlign: "center" }}>... 還有 {excelData.rows.length - 10} 筆</div>}
          </div>
        </div>
        <button onClick={submitExcel} disabled={uploading}
          style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: uploading ? "#888" : "#4361ee", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {uploading ? "⏳ 匯入中..." : `📊 匯入 ${excelData.rows.length} 筆費用`}
        </button>
      </>}
    </Box>
  );
}

const lbl = { fontSize: 10, color: "#666", alignSelf: "center", whiteSpace: "nowrap" };
const inp = { padding: "4px 6px", borderRadius: 5, border: "1px solid #ddd", fontSize: 11 };
const btn = (color, disabled) => ({
  flex: 1, padding: "8px 4px", borderRadius: 6, border: "none",
  background: disabled ? "#ddd" : color, color: "#fff",
  fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
});

function Box({ children }) { return <div style={{ maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif" }}>{children}</div>; }
