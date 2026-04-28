/** @type {import('next').NextConfig} */

// Security headers applied to every response.
// - Strict-Transport-Security: forces HTTPS for the next 2 years (Vercel terminates TLS;
//   keep this header on so browsers refuse downgrade attempts).
// - X-Content-Type-Options: blocks MIME sniffing of CSS / scripts.
// - X-Frame-Options: prevents clickjacking by disallowing iframing.
// - Referrer-Policy: don't leak full URLs to third parties.
// - Permissions-Policy: disable browser features we never use.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
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
