/**
 * Security headers applied to every response.
 *
 * `connect-src` cannot be tightened to a fixed origin list here because the
 * project allows either a local MongoDB instance or MongoDB Atlas; Atlas
 * connections are made from the Node process, not the browser, so 'self' is
 * sufficient for the client. `'unsafe-inline'` is still required for scripts
 * because the App Router streams inline bootstrap/hydration payloads; the
 * upgrade path is a per-request nonce issued by middleware.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://ui-avatars.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    // Only meaningful over HTTPS; browsers ignore it on plain HTTP, so it is
    // safe to send unconditionally (production is HTTPS-only).
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mongoose (and pdf-lib) must run in the Node.js runtime and must not be
  // bundled by the server compiler.
  serverExternalPackages: ["mongoose", "pdf-lib"],
  // Do not advertise the framework.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  eslint: {
    // Lint failures must break the build; `npm run lint` runs the same rules.
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
