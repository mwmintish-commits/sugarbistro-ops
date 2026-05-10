"use client";
// 簡易 Markdown 渲染（不依賴 npm 套件），套小食糖手冊風格
// 支援：# ## ### 標題、**粗體**、`code`、- list、1. ordered、> callout、---、tables、URL 自動連結
// 設計參照：staff-promotions-handbook.pdf（米色 callout、灰色表頭、底線標題）

const COLORS = {
  text: "#222",
  meta: "#888",
  rule: "#1a1a1a",
  callout_bg: "#faf5e8",
  callout_border: "#e8dfc4",
  code_bg: "#f0ebe0",
  th_bg: "#f5f0e5",
  td_border: "#eee",
  link: "#185fa5",
  green_bg: "#e6f9ed",
  red_bg: "#fde8e8",
};

// 行內語法：**bold**、`code`、URL → JSX
function renderInline(text) {
  if (!text) return null;
  // 切 token：**...** / `...` / http(s)://...
  const re = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)]+)/g;
  const parts = text.split(re);
  return parts.map((p, i) => {
    if (!p) return null;
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} style={{ fontWeight: 700, color: COLORS.text }}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={i} style={{ background: COLORS.code_bg, padding: "1px 6px", borderRadius: 3, fontFamily: "ui-monospace, monospace", fontSize: "0.9em" }}>{p.slice(1, -1)}</code>;
    }
    if (p.startsWith("http")) {
      return <a key={i} href={p} target="_blank" rel="noreferrer" style={{ color: COLORS.link, textDecoration: "underline" }}>{p}</a>;
    }
    return <span key={i}>{p}</span>;
  });
}

// 表格：[["標題", "標題"], ["列1欄1", "列1欄2"], ...]
function Table({ rows }) {
  if (!rows || rows.length === 0) return null;
  const [header, ...body] = rows;
  // 偵測 ❌ / ✅ 對比表（套淡紅淡綠背景）
  const isCompare = header && header[0]?.includes("❌") && header[1]?.includes("✅");
  return (
    <div style={{ overflow: "auto", margin: "12px 0", borderRadius: 6, border: `1px solid ${COLORS.td_border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {header.map((h, i) => (
              <th key={i} style={{
                background: isCompare ? (i === 0 ? COLORS.red_bg : COLORS.green_bg) : COLORS.th_bg,
                padding: "10px 12px", textAlign: "left", fontWeight: 600, color: COLORS.text,
                borderBottom: `1px solid ${COLORS.td_border}`,
              }}>{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((c, ci) => (
                <td key={ci} style={{ padding: "10px 12px", borderTop: ri > 0 ? `1px solid ${COLORS.td_border}` : "none", verticalAlign: "top" }}>{renderInline(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 主 parser：把 markdown 字串切成「區塊」陣列
function parseBlocks(md) {
  if (!md) return [];
  const lines = md.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 空行
    if (!trimmed) { i++; continue; }

    // 分隔線
    if (/^---+$/.test(trimmed)) { blocks.push({ type: "hr" }); i++; continue; }

    // 標題
    const h = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (h) { blocks.push({ type: "h", level: h[1].length, text: h[2] }); i++; continue; }

    // 表格
    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\s*\|[-: |]+\|\s*$/.test(lines[i + 1])) {
      const tableRows = [];
      tableRows.push(line.split("|").slice(1, -1).map(c => c.trim()));
      i += 2; // skip header + separator
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableRows.push(lines[i].split("|").slice(1, -1).map(c => c.trim()));
        i++;
      }
      blocks.push({ type: "table", rows: tableRows });
      continue;
    }

    // Callout（連續 > 行）
    if (trimmed.startsWith(">")) {
      const calloutLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        calloutLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "callout", text: calloutLines.join("\n") });
      continue;
    }

    // 無序 list（連續 - 行）
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // 有序 list（連續 1. 2. ...）
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // 段落（連續非空行）
    const para = [];
    while (i < lines.length && lines[i].trim() &&
      !/^#{1,3}\s/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith(">") &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith("|") &&
      !/^---+$/.test(lines[i].trim())) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) blocks.push({ type: "p", text: para.join("\n") });
  }
  return blocks;
}

export default function MarkdownView({ content, dense = false }) {
  if (!content) return null;
  const blocks = parseBlocks(content);
  const fontSize = dense ? 14 : 15;
  const lineHeight = dense ? 1.7 : 1.85;

  return (
    <div style={{ color: COLORS.text, fontSize, lineHeight }}>
      {blocks.map((b, i) => {
        if (b.type === "hr") {
          return <hr key={i} style={{ border: "none", borderTop: `1px solid ${COLORS.td_border}`, margin: "20px 0" }} />;
        }
        if (b.type === "h") {
          if (b.level === 1) return <h1 key={i} style={{ fontSize: 22, fontWeight: 700, margin: "20px 0 10px", paddingBottom: 8, borderBottom: `1px solid ${COLORS.rule}` }}>{renderInline(b.text)}</h1>;
          if (b.level === 2) return <h2 key={i} style={{ fontSize: 17, fontWeight: 700, margin: "24px 0 8px", color: COLORS.text }}>{renderInline(b.text)}</h2>;
          return <h3 key={i} style={{ fontSize: 14, fontWeight: 700, margin: "16px 0 6px", color: COLORS.text }}>{renderInline(b.text)}</h3>;
        }
        if (b.type === "callout") {
          return (
            <div key={i} style={{ background: COLORS.callout_bg, border: `1px solid ${COLORS.callout_border}`, borderRadius: 6, padding: "10px 14px", margin: "10px 0", whiteSpace: "pre-wrap" }}>
              {b.text.split("\n").map((line, li) => <div key={li} style={{ marginBottom: li < b.text.split("\n").length - 1 ? 4 : 0 }}>{renderInline(line)}</div>)}
            </div>
          );
        }
        if (b.type === "ul") {
          return (
            <ul key={i} style={{ margin: "8px 0", paddingLeft: 22 }}>
              {b.items.map((it, ii) => <li key={ii} style={{ marginBottom: 4 }}>{renderInline(it)}</li>)}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} style={{ margin: "8px 0", paddingLeft: 22 }}>
              {b.items.map((it, ii) => <li key={ii} style={{ marginBottom: 4 }}>{renderInline(it)}</li>)}
            </ol>
          );
        }
        if (b.type === "table") {
          return <Table key={i} rows={b.rows} />;
        }
        // p
        return (
          <p key={i} style={{ margin: "10px 0" }}>
            {b.text.split("\n").map((line, li, arr) => (
              <span key={li}>{renderInline(line)}{li < arr.length - 1 && <br />}</span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
