import "server-only";
import { AwsClient } from "aws4fetch";

import { env } from "@/lib/env/server";

// Constructed per call, not at module level: the constructor throws on missing credentials, which would break
// SKIP_ENV_VALIDATION builds that import this module without an environment.
function r2Fetch(key: string, init?: RequestInit) {
    const client = new AwsClient({
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        service: "s3",
        region: "auto",
    });
    return client.fetch(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`, init);
}

/** Whether a plan is already stored under this name. The upload route uses it to avoid overwriting an existing plan. */
export async function planExists(key: string): Promise<boolean> {
    const response = await r2Fetch(key, { method: "HEAD" });
    return response.ok;
}

/**
 * Writes a plan straight to R2 through the app. No presigned upload flow: plans are single HTML files well under
 * Vercel's 4.5 MB request body cap, so the indirection would buy nothing.
 */
export async function putPlan(key: string, html: string): Promise<void> {
    // R2 answers 411 to a PUT without Content-Length. Vercel's runtime has been seen sending a string body chunked,
    // so the length is stated outright instead of trusting fetch to add it.
    const body = Buffer.from(html, "utf8");
    const response = await r2Fetch(key, {
        method: "PUT",
        headers: { "Content-Type": "text/html; charset=utf-8", "Content-Length": String(body.byteLength) },
        body,
    });
    if (!response.ok) {
        throw new Error(`R2 PUT for ${key} failed with status ${response.status}`);
    }
}

/**
 * Reads a plan from R2, or null when no plan has that name. The bucket stays private; GET /<key> streams this
 * response body back so the public URL stays stable and pretty.
 */
export async function fetchPlan(key: string): Promise<Response | null> {
    const response = await r2Fetch(key);
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`R2 GET for ${key} failed with status ${response.status}`);
    }
    return response;
}
