import { describe, expect, it } from "vitest";

import { generatePlanName } from "./plan-name";

describe("generatePlanName", () => {
    it("produces three lowercase words joined by single hyphens", () => {
        for (let i = 0; i < 200; i++) {
            expect(generatePlanName()).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
        }
    });

    it("never repeats the adjective within one name", () => {
        for (let i = 0; i < 200; i++) {
            const [first, second] = generatePlanName().split("-");
            expect(first).not.toBe(second);
        }
    });

    it("varies between calls", () => {
        const names = new Set(Array.from({ length: 50 }, generatePlanName));
        expect(names.size).toBeGreaterThan(1);
    });
});
