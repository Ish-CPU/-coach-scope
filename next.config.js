/** @type {import('next').NextConfig} */

// Production-grade security headers applied to every response.
//
//   Strict-Transport-Security    force HTTPS for 2 years. Vercel terminates TLS;
//                                keep this on so browsers refuse downgrade attacks.
//   X-Content-Type-Options       block MIME sniffing of CSS / scripts.
//   X-Frame-Options + CSP CSP    clickjacking mitigation. CSP here is permissive
//                                ('unsafe-inline' / 'unsafe-eval' on script-src)
//                                because Next.js App Router inlines hydration
//                                scripts without nonces. The bits that actually
//                                matter for hardening are `frame-ancestors none`
//                                (matches X-Frame-Options=DENY), `object-src none`,
//                                and the connect/script/frame allow-lists below.
//   Referrer-Policy              don't leak the full URL to third parties.
//   Permissions-Policy           disable browser APIs we never use.
//   Cross-Origin-Opener-Policy   process isolation; protects against Spectre-class
//                                side-channels and window.opener escalation.
//   Cross-Origin-Resource-Policy same-origin so other origins can't hotlink our
//                                JSON / images by default.
//   X-DNS-Prefetch-Control       explicit; small perf win.
//
// CSP allow-lists cover the third parties we actually load:
//   * Stripe.js     (https://js.stripe.com, https://api.stripe.com)
//   * Vercel Live   (preview-only, harmless in prod)
// Add more origins here when you wire up new third-party scripts/embeds.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.vercel-scripts.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.stripe.com https://*.stripe.com https://api.resend.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self "https://js.stripe.com")',
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig = {
  // Don't fail prod builds on lint — typecheck is the actual gate.
  eslint: { ignoreDuringBuilds: true },
  // Strip server + client console.* in production except error/warn so Vercel
  // logs stay readable and we don't leak internals to the browser console.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  // Catches real bugs (double-effects in dev only).
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
