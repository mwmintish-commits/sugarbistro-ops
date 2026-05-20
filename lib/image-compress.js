// 客戶端圖片壓縮：縮到最長邊 1600px、JPEG 80% 品質
// 一張典型手機照（4032x3024, ~12MB）壓完約 200-400KB，OCR 用 1600px 完全足夠

const MAX_DIM = 1600;
const QUALITY = 0.8;

export async function compressImage(file, opts = {}) {
  const maxDim = opts.maxDim || MAX_DIM;
  const quality = opts.quality || QUALITY;

  // PDF 不壓縮，直接讀為 base64 回傳
  if (file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    return {
      base64: btoa(String.fromCharCode(...new Uint8Array(buf))),
      mimeType: "application/pdf",
      ext: "pdf",
      width: 0, height: 0,
      originalSize: file.size,
      compressedSize: buf.byteLength,
    };
  }

  // 載入為 Image
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = dataUrl;
  });

  // 計算縮放後尺寸（保持長寬比）
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);

  // 輸出為 JPEG dataURL，再切出 base64
  const outDataUrl = canvas.toDataURL("image/jpeg", quality);
  const base64 = outDataUrl.split(",")[1];

  // 估算壓縮後大小（base64 大約是 binary 的 4/3 倍）
  const compressedSize = Math.round((base64.length * 3) / 4);

  return {
    base64,
    mimeType: "image/jpeg",
    ext: "jpg",
    width: w, height: h,
    originalSize: file.size,
    compressedSize,
    preview: outDataUrl, // 給 UI 用，已是壓完的縮圖（不會在記憶體吃太多）
  };
}

// 把 KB 顯示為人類可讀
export function humanSize(bytes) {
  if (!bytes) return "?";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
