import { describe, expect, it } from "vitest";

import { createBrake } from "./brake";

describe("createBrake", () => {
    it("lets normal use through", () => {
        let t = 0;
        const brake = createBrake({ now: () => t });
        for (let i = 0; i < 100; i++) {
            t += 1_000;
            expect(brake("GET /me")).toEqual({ go: true });
        }
    });

    it("stops a loop once, holds it until the rest ends, then lets it try again", () => {
        let t = 0;
        const brake = createBrake({ now: () => t });
        for (let i = 0; i < 50; i++) expect(brake("GET /me").go).toBe(true);
        expect(brake("GET /me")).toEqual({ go: false, tripped: true, waitMs: 30_000 });
        t += 29_000;
        expect(brake("GET /me")).toEqual({ go: false, tripped: false, waitMs: 1_000 });
        t += 1_000;
        expect(brake("GET /me").go).toBe(true);
    });

    it("rests twice as long each time the same loop trips it", () => {
        let t = 0;
        const brake = createBrake({ now: () => t });
        const trip = () => {
            let v = brake("GET /me");
            while (v.go) v = brake("GET /me");
            return v;
        };
        expect(trip()).toMatchObject({ tripped: true, waitMs: 30_000 });
        t += 30_000;
        expect(trip()).toMatchObject({ tripped: true, waitMs: 60_000 });
        t += 60_000;
        expect(trip()).toMatchObject({ tripped: true, waitMs: 120_000 });
    });

    it("keeps each address apart", () => {
        const brake = createBrake({ now: () => 0 });
        for (let i = 0; i < 51; i++) brake("GET /me");
        expect(brake("GET /me").go).toBe(false);
        expect(brake("GET /tenants/a/stores").go).toBe(true);
    });
});
