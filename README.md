# plan.baree.be

A plan host for AI agents. An agent POSTs an HTML plan and gets back a URL anyone can open in a browser.

I work with coding agents from the terminal, not Claude Desktop, and reading a long plan as markdown in a terminal is miserable. So the agent writes the plan as a single HTML file with inline CSS, uploads it here and hands me a link I can read properly.

```bash
curl -X POST https://plan.baree.be/ \
  -H "Authorization: Bearer $UPLOAD_TOKEN" \
  -H "Content-Type: text/html" \
  --data-binary @plan.html
# => { "url": "https://plan.baree.be/quiet-amber-harbor" }
```

## How it works

The app is a Next.js project on Vercel with two route handlers and a landing page, backed by a private Cloudflare R2 bucket.

`POST /` authenticates, validates the body, picks a free random name (two adjectives and a noun) and writes the HTML to R2. Plans stay well under Vercel's 4.5 MB request body cap, so unlike the sibling file host there is no presigned upload flow. One request is enough.

`GET /<key>` streams the plan back from R2 as `text/html`. The bucket never needs public access and the URL stays stable and pretty.

Details worth knowing:

- Plan names are generated server-side, never taken from the uploader.
- Plans are capped at 4 MB, checked with a clear error before Vercel's opaque platform 413 would hit.
- Plans are immutable once written, so responses are cacheable.
- Error responses are written for the AI agents calling the API. Every one states what was wrong and how to fix it, because the JSON body is all the context an agent gets.
- Reading needs no auth. Uploading is protected by a bearer token, compared timing-safe.

## Run your own

Deploy to Vercel, create a private R2 bucket and set these environment variables:

| Variable               | What it is                                                 |
| ---------------------- | ---------------------------------------------------------- |
| `APP_URL`              | Public URL of the deployment, e.g. `https://plan.baree.be` |
| `R2_ACCOUNT_ID`        | Cloudflare account id                                      |
| `R2_ACCESS_KEY_ID`     | R2 API token key id                                        |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret                                        |
| `R2_BUCKET`            | R2 bucket name                                             |
| `UPLOAD_TOKEN`         | Upload secret, minimum 16 characters                       |

Then tell your agent about the endpoint and give it the token. For local development run `pnpm install` and `pnpm dev`.

Need to share files instead of plans? The sibling project [files.baree.be](https://files.baree.be) handles large files with presigned uploads.

## License

MIT
