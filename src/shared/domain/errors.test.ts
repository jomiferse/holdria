import { describe, expect, it } from "vitest";

import { NotFoundError, RateLimitedError, ValidationError, isDomainError } from "./errors";

describe("shared domain errors", () => {
  it("carries a stable machine-readable code", () => {
    const error = new NotFoundError("Portfolio not found");
    expect(error.code).toBe("NOT_FOUND");
    expect(isDomainError(error)).toBe(true);
  });

  it("is not mistaken for an unexpected error", () => {
    expect(isDomainError(new Error("boom"))).toBe(false);
  });

  it("carries field-level details for validation failures", () => {
    const error = new ValidationError("Invalid input", { name: ["Required"] });
    expect(error.fieldErrors.name).toEqual(["Required"]);
  });

  it("carries an optional retry delay for rate-limited requests", () => {
    const error = new RateLimitedError("Too many attempts", 30);
    expect(error.code).toBe("RATE_LIMITED");
    expect(error.retryAfterSeconds).toBe(30);
  });
});
