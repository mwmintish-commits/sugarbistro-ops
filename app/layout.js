export const metadata = {
  title: "小食糖營運系統",
  description: "Sugar Bistro Operations System",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
