import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Production custom domains (future)
      { protocol: "https", hostname: "24therapy.ai" },
      { protocol: "https", hostname: "api.24therapy.ai" },
      { protocol: "https", hostname: "cdn.24therapy.ai" },
      // Railway API host (profile pictures, uploads served via backend)
      { protocol: "https", hostname: "api-24therapy-production.up.railway.app" },
      // AWS S3 / CloudFront (file uploads)
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      // Vercel deployments (all envs)
      { protocol: "https", hostname: "*.vercel.app" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/therapist-join",
        destination: "/for-therapists",
        permanent: true,
      },
      {
        source: "/features/workflow-engine",
        destination: "/features",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
