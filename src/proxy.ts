import { type NextRequest, NextResponse } from "next/server";

/**
 * Runs on every page request (see matcher below) to set a CSP with a per-request nonce. Next.js reads the
 * Content-Security-Policy request header and applies the nonce to every script it renders, so script-src needs no
 * 'unsafe-inline'. This forces dynamic rendering on all pages, an accepted trade-off for a strict CSP.
 */
export function proxy(request: NextRequest) {
    // The upload API is POST / but a route handler cannot share the root path with the landing page, so the public
    // method lands here and rewrites to the internal handler.
    if (request.method === "POST" && request.nextUrl.pathname === "/") {
        return NextResponse.rewrite(new URL("/api/upload", request.url));
    }

    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const isDev = process.env.NODE_ENV === "development";

    const csp = [
        "default-src 'self'",
        // 'strict-dynamic': scripts loaded by nonce-approved scripts (Next chunks) are trusted transitively.
        // 'unsafe-eval' is dev-only: React uses eval for server error overlays.
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
        // 'unsafe-inline' for styles is deliberate: Next and generated shadcn components position and animate via
        // inline style attributes, which nonces cannot cover. Script injection stays fully blocked, which is what
        // matters.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data:",
        "font-src 'self'",
        // The browser only talks to our origin. ws: is dev-only (HMR).
        `connect-src 'self'${isDev ? " ws:" : ""}`,
        "worker-src 'self' blob:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
}

export const config = {
    matcher: [
        // Only the landing page, the sole page in the app. Plans served at /<key> must not get this CSP: they are
        // uploaded HTML documents that bring their own inline styles and scripts.
        {
            source: "/",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
    ],
};
