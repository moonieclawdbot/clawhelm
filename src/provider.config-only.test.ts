import { describe, expect, it } from "vitest";

import { clawhelmProvider } from "./provider.js";

describe("clawhelmProvider config-only runtime", () => {
  it("does not expose wallet env var requirements in active provider path", () => {
    expect(clawhelmProvider.id).toBe("clawhelm");
    expect(clawhelmProvider.envVars).toBeUndefined();
    expect(clawhelmProvider.auth).toEqual([]);
  });

  it("does not bind models to local proxy runtime", () => {
    expect(clawhelmProvider.models).toBeUndefined();
  });
});
