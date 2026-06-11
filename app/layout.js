import "./globals.css";

export const metadata = {
  title: "小食糖營運系統",
  description: "Sugar Bistro Operations System",
  formatDetection: { telephone: false },
};

// 手機適配關鍵：不設 maximumScale/userScalable（無障礙），
// iOS 輸入框自動縮放由 globals.css 的 input font-size:16px 解決
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf6ee",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  );
}
