import { describe, expect, it } from "vitest";
import { computeGoalProgress } from "./progress";

describe("computeGoalProgress", () => {
  it("uses manual progress when there are no steps", () => {
    expect(computeGoalProgress({ manualProgress: 40 }, [])).toBe(40);
  });

  it("weights steps by their weight", () => {
    const steps = [
      { weight: 3, progress: 100 },
      { weight: 1, progress: 0 },
    ];
    expect(computeGoalProgress({ manualProgress: 0 }, steps)).toBe(75);
  });

  it("only reaches 100 when every step is done", () => {
    const steps = [
      { weight: 1, progress: 100 },
      { weight: 1, progress: 99 },
    ];
    expect(computeGoalProgress({ manualProgress: 0 }, steps)).toBe(99);
    expect(computeGoalProgress({ manualProgress: 0 }, [{ weight: 1, progress: 100 }])).toBe(100);
  });
});
