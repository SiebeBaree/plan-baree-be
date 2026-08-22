import { NextResponse } from "next/server";

import { fetchPlan } from "@/features/plans";

// Everything generatePlanName produces matches this. Anything else was never uploaded here, so it 404s before R2.
const KEY_PATTERN = /^[a-z]+-[a-z]+-[a-z]+$/;

/**
 * Serves a plan by streaming it from the private bucket, so the browser URL stays this stable pretty one instead of
 * an expiring presigned R2 URL. Plans are public by design and immutable once written, hence the cacheable response.
 * No CSP here (proxy.ts only covers the landing page): the uploaded HTML brings its own inline styles and scripts.
 */
export async function GET(_request: Request, { params }: RouteContext<"/[key]">) {
    const { key } = await params;
    if (!KEY_PATTERN.test(key)) {
        return new NextResponse("Not found", { status: 404 });
    }

    const plan = await fetchPlan(key);
    if (!plan) {
        return new NextResponse("Not found", { status: 404 });
    }

    return new NextResponse(plan.body, {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
        },
    });
}
