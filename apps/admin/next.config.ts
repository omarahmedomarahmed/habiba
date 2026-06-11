import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Production custom domains (future)
      { protocol: "https", hostname: "24therapy.ai" },
      { protocol: "https", hostname: "api.24therapy.ai" },
      // Railway API host
      { protocol: "https", hostname: "api-24therapy-production.up.railway.app" },
      // AWS S3 / CloudFront
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      // Vercel deployments (all envs)
      { protocol: "https", hostname: "*.vercel.app" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
