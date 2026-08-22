import { connection } from "next/server";

export default async function HomePage() {
    // Nonce-based CSP requires dynamic rendering (see proxy.ts).
    await connection();

    return (
        <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6">
            <h1 className="text-3xl font-semibold tracking-tight">plan.baree.be</h1>
            <p className="text-muted-foreground">
                Plan host for AI agents. POST an HTML plan and get back a URL where anyone can read it.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm">
                {`curl -X POST https://plan.baree.be/ \\
  -H "Authorization: Bearer $UPLOAD_TOKEN" \\
  -H "Content-Type: text/html" \\
  --data-binary @plan.html
# => { "url": "https://plan.baree.be/quiet-amber-harbor" }`}
            </pre>
        </main>
    );
}
