import { describe, expect, it } from "vitest";

import { derivePlanName, generatePlanName } from "./plan-name";

const NAME = /^[a-z]+-[a-z]+-[a-z]+$/;

describe("generatePlanName", () => {
    it("produces three lowercase words joined by single hyphens", () => {
        for (let i = 0; i < 200; i++) {
            expect(generatePlanName()).toMatch(NAME);
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

describe("derivePlanName", () => {
    it("is deterministic for a seed and differs between seeds", () => {
        expect(derivePlanName("a:0")).toBe(derivePlanName("a:0"));
        expect(derivePlanName("a:0")).not.toBe(derivePlanName("a:1"));
        expect(derivePlanName("a:0")).not.toBe(derivePlanName("b:0"));
    });

    it("has the same shape as random names", () => {
        for (let i = 0; i < 200; i++) {
            const name = derivePlanName(`seed:${i}`);
            expect(name).toMatch(NAME);
            const [first, second] = name.split("-");
            expect(first).not.toBe(second);
        }
    });
});
