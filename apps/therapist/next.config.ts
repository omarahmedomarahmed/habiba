import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@24therapy/types"],
  images: {
    remotePatterns: [
      // Production custom domains (future)
      { protocol: "https", hostname: "24therapy.ai" },
      { protocol: "https", hostname: "api.24therapy.ai" },
      { protocol: "https", hostname: "storage.24therapy.ai" },
      // GitHub avatars (OAuth profile pictures)
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Railway API host (file uploads / patient photos)
      { protocol: "https", hostname: "api-24therapy-production.up.railway.app" },
      // AWS S3 / CloudFront
      { protocol: "https", hostname: "*.s3.amazonaws.com" },
      { protocol: "https", hostname: "*.cloudfront.net" },
      // Vercel deployments (all envs)
      { protocol: "https", hostname: "*.vercel.app" },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_NAME: "24Therapy Therapist Portal",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
