import { describe, expect, it } from "vitest";
import { eachDate, getPeriodRange, isScheduledOn } from "./dates";

describe("date helpers", () => {
  it("builds a Monday to Sunday week", () => {
    expect(getPeriodRange("week", "2026-09-13")).toEqual({ startDate: "2026-09-07", endDate: "2026-09-13" });
  });

  it("evaluates weekday recurrence masks", () => {
    const mondayAndFriday = { type: "habit" as const, recurrenceMask: (1 << 0) | (1 << 4) };
    expect(isScheduledOn(mondayAndFriday, "2026-09-07")).toBe(true);
    expect(isScheduledOn(mondayAndFriday, "2026-09-08")).toBe(false);
    expect(isScheduledOn(mondayAndFriday, "2026-09-11")).toBe(true);
  });

  it("enumerates inclusive ranges", () => {
    expect(eachDate("2026-09-11", "2026-09-13")).toEqual(["2026-09-11", "2026-09-12", "2026-09-13"]);
  });
});
