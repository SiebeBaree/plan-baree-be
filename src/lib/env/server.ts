import "server-only";
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

/**
 * Server-only environment variables. The "server-only" import makes any accidental client-side import a build error
 * instead of a leaked secret.
 *
 * Everything R2 plus UPLOAD_TOKEN is always required: the app is an upload service and cannot function without them.
 * UPLOAD_TOKEN has a length floor so a weak token fails the deploy instead of guarding the endpoint badly. APP_URL is
 * required in production only, dev falls back to localhost.
 */
export const env = createEnv({
    server: {
        APP_URL: isProd ? z.url() : z.url().optional(),
        R2_ACCOUNT_ID: z.string().min(1),
        R2_ACCESS_KEY_ID: z.string().min(1),
        R2_SECRET_ACCESS_KEY: z.string().min(1),
        R2_BUCKET: z.string().min(1),
        UPLOAD_TOKEN: z.string().min(16),
    },
    experimental__runtimeEnv: {},
    emptyStringAsUndefined: true,
    // For builds that have no environment, e.g. CI: SKIP_ENV_VALIDATION=1 pnpm build
    skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
});
