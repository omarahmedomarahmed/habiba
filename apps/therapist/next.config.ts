import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@24therapy/types"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "24therapy.ai" },
      { protocol: "https", hostname: "api.24therapy.ai" },
      { protocol: "https", hostname: "storage.24therapy.ai" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
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
