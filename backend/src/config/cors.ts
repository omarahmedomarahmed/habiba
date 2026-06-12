const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
];

export function buildCorsOriginFn(isProd: boolean) {
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const allowedOrigins = isProd
    ? envOrigins
    : [
        ...DEV_ORIGINS,
        // Dev preview Vercel URLs (only in non-production)
        'https://24-web.vercel.app',
        'https://24-therapist.vercel.app',
        'https://24-patient.vercel.app',
        'https://24-admin.vercel.app',
        ...envOrigins,
      ];

  return function origin(
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    // Allow requests with no origin (health checks, Stripe webhooks, curl)
    if (!requestOrigin) return callback(null, true);
    if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${requestOrigin}`));
  };
}
