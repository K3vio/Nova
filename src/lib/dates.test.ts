import { describe, expect, it } from "vitest";
import { daysBetween, describeDue, todayISO } from "./dates";

describe("dates", () => {
  it("formats today as YYYY-MM-DD", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("counts days across a DST change", () => {
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("describes due dates relative to today", () => {
    expect(describeDue("2026-10-12", "2026-10-12")).toEqual({ label: "Oct 12 · today", tone: "soon" });
    expect(describeDue("2026-10-15", "2026-10-12").tone).toBe("soon");
    expect(describeDue("2026-11-30", "2026-10-12").tone).toBe("later");
    expect(describeDue("2026-10-10", "2026-10-12")).toEqual({
      label: "Oct 10 · 2 days overdue",
      tone: "overdue",
    });
    expect(describeDue("2027-01-03", "2026-10-12").label).toBe("Jan 3, 2027 · in 83 days");
  });
});
