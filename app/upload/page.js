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
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setType(p.get("type") || "settlement");
    setStoreId(p.get("store_id") || "");
    setStoreName(p.get("store_name") || "");
    setEmpId(p.get("employee_id") || "");
    setEmpName(p.get("employee_name") || "");
  }, []);

  const typeLabels = { settlement: "📊 日結單", deposit: "🏦 存款單", expense: "📦 費用單據" };

  const addPhotos = (files) => {
    const newPhotos = [...photos];
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPhotos.push({ file, preview: e.target.result, name: file.name });
        setPhotos([...newPhotos]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (idx) => setPhotos(photos.filter((_, i) => i !== idx));

  const submit = async () => {
    if (photos.length === 0) { alert("請至少上傳一張照片"); return; }
    setUploading(true);
    try {
      const urls = [];
      for (const p of photos) {
        const b64 = p.preview.split(",")[1];
        const res = await fetch("/api/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64: b64, folder: type + "s", filename: storeId + "_" + Date.now() + "_" + urls.length }),
        }).then(r => r.json());
        if (res.url) urls.push(res.url);
      }

      // Process first image with AI
      const firstB64 = photos[0].preview.split(",")[1];
      const aiRes = await fetch("/api/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "analyze", type, base64: firstB64, store_id: storeId, store_name: storeName, employee_id: empId, employee_name: empName, image_urls: urls }),
      }).then(r => r.json());

      setResult({ ...aiRes, image_urls: urls });
      setDone(true);
    } catch (e) { alert("上傳失敗：" + e.message); }
    setUploading(false);
  };

  if (done && result) return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "-apple-system,sans-serif" }}>
      <div style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 16, fontWeight: 600, textAlign: "center", marginBottom: 8 }}>{typeLabels[type]} 已上傳</div>
      <div style={{ fontSize: 13, color: "#888", textAlign: "center", marginBottom: 16 }}>共 {result.image_urls?.length || 0} 張照片</div>
      {result.redirect && <a href={result.redirect} style={{ display: "block", textAlign: "center", padding: 14, borderRadius: 8, background: "#4361ee", color: "#fff", fontWeight: 600, textDecoration: "none" }}>📝 核對辨識結果</a>}
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#888" }}>可關閉此頁面</div>
    </div>
  );

  return (
    <div style={{ maxWidth: 420, margin: "0 auto", padding: 16, fontFamily: "-apple-system,sans-serif" }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{typeLabels[type] || "📸 上傳"}</h2>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{storeName} {empName ? "(" + empName + ")" : ""}</div>

      {/* 照片列表 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid #eee", aspectRatio: "1" }}>
            <img src={p.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={() => removePhoto(i)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: 9, padding: "2px 4px", textAlign: "center" }}>第 {i + 1} 張</div>
          </div>
        ))}

        {/* 新增按鈕 */}
        <label style={{ borderRadius: 8, border: "2px dashed #ccc", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#faf8f5" }}>
          <div style={{ fontSize: 28, color: "#ccc" }}>+</div>
          <div style={{ fontSize: 10, color: "#888" }}>選擇照片</div>
          <input type="file" accept="image/*" multiple onChange={e => addPhotos(e.target.files)} style={{ display: "none" }} />
        </label>

        <label style={{ borderRadius: 8, border: "2px dashed #ccc", aspectRatio: "1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#faf8f5" }}>
          <div style={{ fontSize: 28, color: "#ccc" }}>📷</div>
          <div style={{ fontSize: 10, color: "#888" }}>拍照</div>
          <input type="file" accept="image/*" capture="environment" onChange={e => addPhotos(e.target.files)} style={{ display: "none" }} />
        </label>
      </div>

      {photos.length > 0 && (
        <div style={{ fontSize: 12, color: "#666", marginBottom: 12, textAlign: "center" }}>
          已選擇 {photos.length} 張照片
        </div>
      )}

      <button onClick={submit} disabled={uploading || photos.length === 0}
        style={{ width: "100%", padding: 14, borderRadius: 8, border: "none",
          background: photos.length === 0 ? "#ddd" : uploading ? "#888" : "#0a7c42",
          color: "#fff", fontSize: 15, fontWeight: 600, cursor: photos.length === 0 ? "default" : "pointer" }}>
        {uploading ? "⏳ 上傳中..." : "📤 上傳 " + photos.length + " 張照片"}
      </button>
    </div>
  );
}
