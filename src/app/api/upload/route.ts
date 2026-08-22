import { timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { generatePlanName, planExists, putPlan } from "@/features/plans";
import { env } from "@/lib/env/server";
import { siteUrl } from "@/lib/site";

// Vercel rejects request bodies over 4.5 MB before they reach us; this limit exists to answer with a useful error
// instead of an opaque platform 413.
const MAX_PLAN_BYTES = 4 * 1024 * 1024;

const EXAMPLE_REQUEST = `curl --fail-with-body -X POST ${siteUrl.href} -H 'Authorization: Bearer <UPLOAD_TOKEN>' -H 'Content-Type: text/html' --data-binary @plan.html`;

// Timing-safe so the token cannot be guessed byte by byte from response times.
function isAuthorized(request: NextRequest) {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return false;
    const expected = Buffer.from(env.UPLOAD_TOKEN);
    const received = Buffer.from(token);
    return received.length === expected.length && timingSafeEqual(received, expected);
}

// The public API is POST /; proxy.ts rewrites that here because a route handler cannot share / with the landing page.
export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) {
        return NextResponse.json(
            {
                error: "Unauthorized: missing or invalid bearer token.",
                fix: `Send an 'Authorization: Bearer <UPLOAD_TOKEN>' header, where UPLOAD_TOKEN is this deployment's upload secret (ask the owner if you do not have it). Example: ${EXAMPLE_REQUEST}`,
            },
            { status: 401 },
        );
    }

    const html = await request.text();
    if (html.trim() === "") {
        return NextResponse.json(
            {
                error: "Request body is empty.",
                fix: `Send the HTML plan as the raw request body. Example: ${EXAMPLE_REQUEST}`,
            },
            { status: 400 },
        );
    }
    if (Buffer.byteLength(html) > MAX_PLAN_BYTES) {
        return NextResponse.json(
            {
                error: `Plan is ${Buffer.byteLength(html)} bytes but the limit is ${MAX_PLAN_BYTES} bytes (4 MB).`,
                fix: "Plans are single HTML files with inline CSS; trim embedded assets (e.g. base64 images) until the file is under 4 MB.",
            },
            { status: 413 },
        );
    }

    // Names are random words, so a fresh name can collide with a stored plan. Check candidates against R2 and take
    // the first free one; the tiny window between check and write is an accepted race for a low-traffic service.
    const candidates = Array.from({ length: 5 }, generatePlanName);
    const taken = await Promise.all(candidates.map(planExists));
    const key = candidates.find((_, index) => !taken[index]);
    if (key === undefined) {
        return NextResponse.json(
            { error: "Could not find a free plan name after 5 attempts. Retry the request." },
            { status: 500 },
        );
    }

    await putPlan(key, html);
    return NextResponse.json({ url: new URL(`/${key}`, siteUrl).href });
}
