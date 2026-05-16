/** @type {import('next').NextConfig} */
const nextConfig = {
  // API 路由不要被瀏覽器/CDN 快取，避免員工看到舊資料
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
