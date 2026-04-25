"use client";
import { useState, useEffect } from "react";

const fmt = n => "$" + Number(n || 0).toLocaleString();

export default function UploadPage() {
  const [type, setType] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [photos, setPhotos] = useState([]);
  const [excelData, setExcelData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: "" });
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setType(p.get("type") || "expense");
    setStoreId(p.get("store_id") || "");
    setStoreName(decodeURIComponent(p.get("store_name") || ""));
    setEmpId(p.get("employee_id") || "");
    setEmpName(decodeURIComponent(p.get("employee_name") || ""));
  }, []);

  const expenseType = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("expense_type") || "vendor";
  const typeLabels = {
    settlement: "📊 日結單", deposit: "🏦 存款單",
    expense: expenseType === "petty_cash" ? "🪙 零用金收據" : expenseType === "hq_advance" ? "🏢 總部代付" : "📦 月結單據",
  };

  const addPhotos = (files) => {
    const newP = [...photos];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => { newP.push({ file, preview: e.target.result, name: file.name }); setPhotos([...newP]); };
      reader.readAsDataURL(file);
    });
  };

  const handleExcel = async (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      // CSV parsing
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
    setUploading(true);
    const allResults = [];
    
    for (let i = 0; i < photos.length; i++) {
      setProgress({ current: i + 1, total: photos.length, status: "上傳第 " + (i + 1) + " 張..." });
      const b64 = photos[i].preview.split(",")[1];
      try {
        // Step 1: 上傳圖片
        const upRes = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64, folder: type + "s", filename: storeId + "_" + Date.now() + "_" + i }),
        }).then(r => r.json());

        // Step 2: AI 辨識
        setProgress({ current: i + 1, total: photos.length, status: "辨識第 " + (i + 1) + " 張..." });
        const aiRes = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyze", type, base64: b64, store_id: storeId, store_name: storeName, employee_id: empId, employee_name: empName, image_url: upRes.url, expense_type: expenseType }),
        }).then(r => r.json());

        const ok = !aiRes.error && !!aiRes.draft_id;
        allResults.push({ index: i + 1, image_url: upRes.url, ...aiRes, success: ok });
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

  // ===== 完成畫面 =====
  if (done) return (
    <Box>
      <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 600, textAlign: "center", marginBottom: 16 }}>{typeLabels[type]} 上傳完成</div>
      
      {results.map((r, i) => (
        <div key={i} style={{ background: r.success ? "#e6f9f0" : "#fde8e8", borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {r.imported !== undefined ? `📊 匯入 ${r.imported}/${r.total} 筆` : `第 ${r.index} 張 ${r.success ? "✅" : "❌"}`}
          </div>
          {r.vendor_name && <div>🏢 {r.vendor_name}</div>}
          {r.amount > 0 && <div>💰 {fmt(r.amount)}</div>}
          {r.invoice_number && <div>🧾 {r.invoice_number}</div>}
          {r.error && <div style={{ color: "#b91c1c" }}>❌ {r.error}</div>}
          {r.draft_id && <a href={"/expense-review?id=" + r.draft_id} style={{ color: "#4361ee", fontSize: 11 }}>📝 修改</a>}
        </div>
      ))}
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#888" }}>可關閉此頁面</div>
    </Box>
  );

  // ===== 上傳畫面 =====
  return (
    <Box>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{typeLabels[type] || "📸 上傳"}</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{storeName} {empName ? "— " + empName : ""}</div>

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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
          {photos.map((p, i) => (
            <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #eee", aspectRatio: "1" }}>
              <img src={p.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, cursor: "pointer" }}>✕</button>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 9, padding: "2px 4px", textAlign: "center" }}>第{i+1}張</div>
            </div>
          ))}
          <label style={{ borderRadius: 8, border: "2px dashed #ccc", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#faf8f5" }}>
            <div style={{ fontSize: 28, color: "#ccc" }}>+</div>
            <div style={{ fontSize: 10, color: "#888" }}>選擇多張</div>
            <input type="file" accept="image/*" multiple onChange={e => addPhotos(e.target.files)} style={{ display: "none" }} />
          </label>
          <label style={{ borderRadius: 8, border: "2px dashed #ccc", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#faf8f5" }}>
            <div style={{ fontSize: 28, color: "#ccc" }}>📷</div>
            <div style={{ fontSize: 10, color: "#888" }}>拍照</div>
            <input type="file" accept="image/*" capture="environment" onChange={e => addPhotos(e.target.files)} style={{ display: "none" }} />
          </label>
        </div>
        <div style={{ fontSize: 11, color: "#888", textAlign: "center", marginBottom: 8 }}>
          {photos.length > 0 ? `已選 ${photos.length} 張，每張分別辨識建立草稿` : "支援一次選多張，每張會獨立辨識"}
        </div>
        <button onClick={submitPhotos} disabled={uploading || photos.length === 0}
          style={{ width: "100%", padding: 14, borderRadius: 8, border: "none", background: photos.length === 0 ? "#ddd" : uploading ? "#888" : "#0a7c42", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
          {uploading ? `⏳ ${progress.status}（${progress.current}/${progress.total}）` : `📤 上傳 ${photos.length} 張，逐張辨識`}
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

function Box({ children }) { return <div style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "system-ui, 'Noto Sans TC', sans-serif" }}>{children}</div>; }
