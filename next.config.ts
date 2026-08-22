import type { NextConfig } from "next";

// The per-request CSP lives in proxy.ts. These static headers apply to every response, including static assets.
const securityHeaders = [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
    typedRoutes: true,
    async headers() {
        return [{ source: "/(.*)", headers: securityHeaders }];
    },
};

export default nextConfig;
