import { describe, expect, it } from "vitest";

import {
    formatDate,
    formatDateTime,
    formatMoney,
    formatMonth,
    formatRelative,
    formatTime,
    localDate,
} from "./index";

// 23:30 UTC on 21 Oct is 06:30 on 22 Oct in Jakarta.
const now = "2026-10-21T23:30:00Z";

describe("localDate", () => {
    it("uses the store's calendar day, not UTC's", () => {
        expect(localDate(now)).toBe("2026-10-22");
        expect(localDate("2026-10-21T16:59:00Z")).toBe("2026-10-21");
    });
});

describe("formatDate", () => {
    it("drops the year inside the current year", () => {
        expect(formatDate("2026-03-05T05:00:00Z", "en", now)).toBe("5 Mar");
        expect(formatDate("2026-03-05T05:00:00Z", "id", now)).toBe("5 Mar");
        expect(formatDate("2026-08-05T05:00:00Z", "id", now)).toBe("5 Agu");
    });

    it("shows the year outside it", () => {
        expect(formatDate("2025-12-31T05:00:00Z", "en", now)).toBe("31 Dec 2025");
    });
});

describe("formatTime and formatDateTime", () => {
    it("shows the store's clock, 24 hours", () => {
        expect(formatTime(now, "en")).toBe("06:30");
        expect(formatTime("2026-10-22T11:05:00Z", "id")).toBe("18.05");
        expect(formatDateTime(now, "en", now)).toBe("22 Oct, 06:30");
    });
});

describe("formatMonth", () => {
    it("takes a month or a date", () => {
        expect(formatMonth("2026-10", "en")).toBe("October 2026");
        expect(formatMonth("2026-10", "id")).toBe("Oktober 2026");
    });
});

describe("formatRelative", () => {
    it("counts minutes and hours", () => {
        expect(formatRelative("2026-10-21T23:25:00Z", "en", now)).toBe("5 min ago");
        expect(formatRelative("2026-10-21T21:30:00Z", "en", now)).toBe("2 hr ago");
    });

    it("counts store days, not 24-hour spans", () => {
        // 23:00 on 21 Oct in Jakarta: yesterday, though under 24 hours ago.
        expect(formatRelative("2026-10-21T16:00:00Z", "en", now)).toBe("yesterday");
        expect(formatRelative("2026-10-21T16:00:00Z", "id", now)).toBe("kemarin");
    });

    it("falls back to the date after a week", () => {
        expect(formatRelative("2026-10-01T05:00:00Z", "en", now)).toBe("1 Oct");
    });
});

describe("formatMoney", () => {
    it("is rupiah with Indonesian grouping", () => {
        expect(formatMoney(15000)).toBe("Rp 15.000");
        expect(formatMoney(0)).toBe("Rp 0");
    });
});
