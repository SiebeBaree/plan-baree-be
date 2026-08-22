import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
    },
    resolve: {
        alias: {
            "@": path.resolve(import.meta.dirname, "src"),
            // The real package throws outside RSC. Unit tests run server modules in plain Node, so it becomes a no-op.
            "server-only": path.resolve(import.meta.dirname, "test/mocks/server-only.ts"),
        },
    },
});
