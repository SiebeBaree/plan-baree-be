import "server-only";
import { AwsClient } from "aws4fetch";

import { env } from "@/lib/env/server";

// Object metadata recording which upload source (see the upload route) a plan belongs to. Absent on plans that were
// uploaded without a path.
const SOURCE_HEADER = "x-amz-meta-source";

/**
 * Signs and sends one request to R2. Signing and sending are split on purpose: AwsClient.fetch hands a Request
 * object to the global fetch, and Next's patched fetch rebuilds Request inputs from their body stream, which drops
 * Content-Length and sends the body chunked. R2 answers chunked PUTs with 411. Passing the body through init keeps
 * the length intact. The client is built per call because its constructor throws on missing credentials, which
 * would break SKIP_ENV_VALIDATION builds that import this module without an environment.
 */
async function r2Fetch(key: string, init: { method?: string; headers?: HeadersInit; body?: string } = {}) {
    const client = new AwsClient({
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        service: "s3",
        region: "auto",
    });
    const url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/${key}`;
    const signed = await client.sign(url, init);
    return fetch(signed.url, { method: signed.method, headers: signed.headers, body: init.body });
}

/**
 * Looks up a plan by name: null when the name is free, otherwise the source it was uploaded from (null for plans
 * uploaded without a path). The upload route uses this to tell "update my plan" from "overwrite someone else's".
 */
export async function headPlan(key: string): Promise<{ source: string | null } | null> {
    const response = await r2Fetch(key, { method: "HEAD" });
    if (response.status === 404) return null;
    if (!response.ok) {
        throw new Error(`R2 HEAD for ${key} failed with status ${response.status}`);
    }
    return { source: response.headers.get(SOURCE_HEADER) };
}

/**
 * Writes a plan straight to R2 through the app. No presigned upload flow: plans are single HTML files well under
 * Vercel's 4.5 MB request body cap, so the indirection would buy nothing. Overwrites whatever is under the key.
 */
export async function putPlan(key: string, html: string, source: string | null): Promise<void> {
    const response = await r2Fetch(key, {
        method: "PUT",
        headers: {
            "Content-Type": "text/html; charset=utf-8",
            ...(source === null ? {} : { [SOURCE_HEADER]: source }),
        },
        body: html,
    });
    if (!response.ok) {
        throw new Error(`R2 PUT for ${key} failed with status ${response.status}`);
    }
}

/**
 * Reads a plan from R2, or null when no plan has that name. The bucket stays private; GET /<key> streams this
 * response body back so the public URL stays stable and pretty. The browser's If-None-Match is passed through, so
 * the response can be a 304 when the plan is unchanged.
 */
export async function fetchPlan(key: string, ifNoneMatch: string | null): Promise<Response | null> {
    const response = await r2Fetch(key, { headers: ifNoneMatch === null ? {} : { "If-None-Match": ifNoneMatch } });
    if (response.status === 404) return null;
    if (!response.ok && response.status !== 304) {
        throw new Error(`R2 GET for ${key} failed with status ${response.status}`);
    }
    return response;
}
