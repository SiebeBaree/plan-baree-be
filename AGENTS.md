# plan-baree-be

plan.baree.be is a plan host for AI agents. An agent POSTs an HTML plan as the raw request body to `/` with a bearer token and gets back a `url` where anyone can read the plan, like `https://plan.baree.be/quiet-amber-harbor`. Names are generated from words (two adjectives and a noun), never taken from the uploader. The optional `X-Plan-Path` header is the plan's identity: the same path updates the same plan, a new path or no path creates a new one.

The app is a Next.js project on Vercel with two route handlers and a landing page. Plans are single HTML files with inline CSS, always under Vercel's 4.5 MB request body cap, so the upload route writes the body straight to Cloudflare R2 with no presigned upload flow. `GET /<key>` streams the plan back from the private bucket so the public URL stays stable and pretty. Reading needs no auth by design; only uploading is protected. Error responses are written for the AI agents doing the uploads: every one states what was wrong and how to fix it.

## Principles

- Yagni. Fight for the smallest change that makes the behavior correct. Do not add abstractions for imagined futures and do not preserve complexity just because it exists.
- Typesafety over defensiveness. `any` is banned (lint enforced). Let inference flow; if you fight the types, the design is probably wrong.
- Routes compose, features implement. A page awaits queries and renders feature components. When a page grows logic, move that logic into the feature.
- A lib entry starts as a single file. The moment it needs a test or a second file, it becomes a folder with the test inside.
- Comments only for what the code cannot show: framework magic, security trade-offs, policy, traps. Never restate the code. No em-dashes and no oxford commas anywhere, including comments.
- Run `pnpm typecheck && pnpm lint && pnpm test && pnpm format` before finishing any change. Lint warnings fail the build on purpose.
- Do not create documentation files (README, docs/) unless explicitly asked.

## Glossary

- **Feature**: a vertical slice under `features/` owning its schema and logic. Client components import siblings directly; the feature barrel is server-only.
- **Page**: a route file under `app/`. Thin on purpose: it awaits queries and renders feature components. A new page should contain nothing else.
- **Route handler**: an API endpoint under `app/api`. It authenticates, validates and answers JSON. Error bodies are the API's documentation for agents, keep them specific and actionable.

## Observability

Vercel's request and function logs are the only observability. Do not add logging, analytics or error tracking SDKs without a demonstrated need.

## Testing: when and what

Test the things that can be wrong in interesting ways. Real logic like plan name generation gets colocated Vitest tests. Route handlers and R2 access have no honest unit-test story (mocking R2 proves nothing), so verify them against a deployed preview with curl. Do not write smoke tests that assert a page renders, regression tests for deleted features or tests that mock half the app; if a unit test needs heavy infrastructure mocking, the seam is wrong, move the logic. A fixed bug earns a regression test only when the bug was real logic, not glue.

## Things you need to know

- The landing page renders dynamically because the CSP nonce requires a per-request render. `await connection()` is the explicit opt-in; awaiting a database call does not prevent static prerendering. Do not remove it, do not add static rendering back.
- The strict CSP in `proxy.ts` covers only the landing page. Plans served at `/<key>` deliberately get no CSP: they are uploaded HTML documents with their own inline styles and scripts. Do not widen the proxy matcher back over them.
- The public upload API is `POST /`, rewritten in `proxy.ts` to the internal `/api/upload` handler, because a route handler cannot share the root path with the landing page.
- Uploads go through the app, not through presigned URLs. Plans are always under Vercel's 4.5 MB body cap, so the upload route validates, picks a free name and PUTs the body to R2 itself. Do not reintroduce a presign flow.
- Plan names come from `plan-name.ts`: random for uploads without a path, derived from an HMAC of the path (keyed with `UPLOAD_TOKEN`, so URLs cannot be predicted from guessable paths) otherwise. The name space is finite, so the upload route HEADs candidates and only writes a name that is free or already holds this path's plan, recorded in the object's `x-amz-meta-source` metadata. The check-then-write race is accepted for a low-traffic service.
- R2 requests are signed with aws4fetch but sent with a plain `fetch(url, init)`, never `AwsClient.fetch`. Next's patched fetch rebuilds Request inputs from their body stream, which drops Content-Length, and R2 rejects chunked PUTs with 411. This was the cause of most failed uploads; do not switch back.
- The bucket needs no public access. `GET /<key>` streams the object from R2 with signed server-side requests and serves it as `text/html`. Plans can be updated in place, so responses are `no-cache` and revalidate through R2's ETag. Do not add a max-age.
- There is no auth on reads by design. The upload API authenticates with the `UPLOAD_TOKEN` bearer token, compared timing-safe, with a length floor in the env schema.
- Importing server code into a client component is a build error via `server-only`. Type-only imports across that boundary are safe and lint-enforced (`import type`), and load-bearing: dropping the `type` keyword ships server code to the browser.
- Builds without an environment use `SKIP_ENV_VALIDATION=1`. Never weaken a required env var to optional to make a build pass; the fail-fast is the point.
- Formatting is oxfmt's job, including import order and Tailwind class order. Never hand-format or reorder imports.
- shadcn components are generated into `components/ui` with the shadcn CLI, do not hand-edit them beyond what a change genuinely requires. None are installed right now; add them with the CLI when UI needs them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
