/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 画像最適化（Supabase Storage / 講師アバター等を想定）
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google avatar
      },
      {
        protocol: 'https',
        hostname: 'profile.line-scdn.net', // LINE avatar
      },
    ],
  },
  // セキュリティヘッダ
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  experimental: {
    // Server Actions のbody size制限を引き上げる場合は設定する
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
