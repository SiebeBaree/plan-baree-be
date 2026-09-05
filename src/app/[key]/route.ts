import { NextResponse } from "next/server";

import { fetchPlan } from "@/features/plans";

// Everything the plan name generator produces matches this. Anything else was never uploaded here, so it 404s
// before R2.
const KEY_PATTERN = /^[a-z]+-[a-z]+-[a-z]+$/;

/**
 * Serves a plan by streaming it from the private bucket, so the browser URL stays this stable pretty one instead of
 * an expiring presigned R2 URL. Plans are public by design and can be updated in place, so nothing may cache them:
 * every view revalidates against R2's ETag and gets a 304 when unchanged. No CSP here (proxy.ts only covers the
 * landing page): the uploaded HTML brings its own inline styles and scripts.
 */
export async function GET(request: Request, { params }: RouteContext<"/[key]">) {
    const { key } = await params;
    if (!KEY_PATTERN.test(key)) {
        return new NextResponse("Not found", { status: 404 });
    }

    const plan = await fetchPlan(key, request.headers.get("if-none-match"));
    if (!plan) {
        return new NextResponse("Not found", { status: 404 });
    }

    const headers = new Headers({ "Cache-Control": "no-cache" });
    const etag = plan.headers.get("etag");
    if (etag) headers.set("ETag", etag);
    if (plan.status === 304) {
        return new NextResponse(null, { status: 304, headers });
    }
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new NextResponse(plan.body, { headers });
}
