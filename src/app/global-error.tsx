"use client";

// Replaces the root layout when it crashes, so it must render its own <html> and stay dependency-free.
export default function GlobalError() {
    return (
        <html lang="en">
            <body
                style={{
                    fontFamily: "system-ui, sans-serif",
                    padding: "4rem 1.5rem",
                    maxWidth: "28rem",
                    margin: "0 auto",
                }}
            >
                <h1>Something went wrong</h1>
                <p>Please reload the page.</p>
            </body>
        </html>
    );
}
