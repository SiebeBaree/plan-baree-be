import { createHmac, timingSafeEqual } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import { derivePlanName, generatePlanName, headPlan, putPlan } from "@/features/plans";
import { env } from "@/lib/env/server";
import { siteUrl } from "@/lib/site";

// Vercel rejects request bodies over 4.5 MB before they reach us; this limit exists to answer with a useful error
// instead of an opaque platform 413.
const MAX_PLAN_BYTES = 4 * 1024 * 1024;

const NAME_ATTEMPTS = 5;

const EXAMPLE_REQUEST = `curl --fail-with-body -X POST ${siteUrl.href} -H 'Authorization: Bearer <UPLOAD_TOKEN>' -H 'Content-Type: text/html' -H 'X-Plan-Path: /absolute/path/to/plan.html' --data-binary @/absolute/path/to/plan.html`;

// Timing-safe so the token cannot be guessed byte by byte from response times.
function isAuthorized(request: NextRequest) {
    const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return false;
    const expected = Buffer.from(env.UPLOAD_TOKEN);
    const received = Buffer.from(token);
    return received.length === expected.length && timingSafeEqual(received, expected);
}

/**
 * The public API is POST /; proxy.ts rewrites that here because a route handler cannot share / with the landing page.
 *
 * A plan is identified by the path it was uploaded from (X-Plan-Path). Uploading from the same path again updates
 * the plan at the same URL; a new path or no path at all creates a new plan.
 */
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

    const path = request.headers.get("x-plan-path")?.trim();
    if (path === "") {
        return NextResponse.json(
            {
                error: "X-Plan-Path header is present but empty.",
                fix: `Send the absolute path of the plan file so re-uploads update the same plan, or omit the header to create a new plan under a fresh name. Example: ${EXAMPLE_REQUEST}`,
            },
            { status: 400 },
        );
    }
    // Keyed with the upload token so nobody can predict a plan URL from a guessable path like /tmp/plan.html. The
    // trade-off: rotating the token gives every path a new URL on its next upload.
    const source = path === undefined ? null : createHmac("sha256", env.UPLOAD_TOKEN).update(path).digest("hex");

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

    // With a source the candidate names are derived from it, so a re-upload lands on the name it used before and
    // overwrites its own plan. Without one they are random. A name is only written when it is free or already holds
    // this source's plan; the window between check and write is an accepted race for a low-traffic service.
    const candidates = Array.from({ length: NAME_ATTEMPTS }, (_, attempt) =>
        source === null ? generatePlanName() : derivePlanName(`${source}:${attempt}`),
    );
    const existing = await Promise.all(candidates.map(headPlan));
    const index = existing.findIndex((plan) => plan === null || (source !== null && plan.source === source));
    if (index !== -1) {
        const key = candidates[index];
        await putPlan(key, html, source);
        return NextResponse.json({ url: new URL(`/${key}`, siteUrl).href, updated: existing[index] !== null });
    }
    return NextResponse.json(
        {
            error: `Could not find a free plan name after ${NAME_ATTEMPTS} attempts.`,
            fix: "Retry the request. If it keeps failing with an X-Plan-Path, upload from a different path.",
        },
        { status: 500 },
    );
}
