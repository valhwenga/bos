import { describe, it, expect } from "vitest";
import { safeReturnPath } from "./Login";

/**
 * The post-login redirect. An attacker who can influence where someone lands
 * straight after authenticating has a convincing phishing step, so anything
 * that is not plainly an internal path falls back to the dashboard.
 */
describe("safeReturnPath", () => {
  it("keeps an ordinary internal path", () => {
    expect(safeReturnPath("/accounting/invoices")).toBe("/accounting/invoices");
    expect(safeReturnPath("/hrm/leave?status=pending")).toBe("/hrm/leave?status=pending");
  });

  it("falls back to the dashboard when there is nothing to return to", () => {
    expect(safeReturnPath(undefined)).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
    expect(safeReturnPath("")).toBe("/");
    expect(safeReturnPath(42)).toBe("/");
  });

  it("refuses a protocol-relative URL, which browsers treat as off-site", () => {
    // "//evil.example.com" inherits the current scheme and leaves the site.
    expect(safeReturnPath("//evil.example.com")).toBe("/");
    expect(safeReturnPath("///evil.example.com")).toBe("/");
  });

  it("refuses backslashes, which several browsers normalise to slashes", () => {
    expect(safeReturnPath("\\\\evil.example.com")).toBe("/");
    expect(safeReturnPath("/\\evil.example.com")).toBe("/");
  });

  it("refuses an absolute URL with a scheme", () => {
    expect(safeReturnPath("https://evil.example.com")).toBe("/");
    expect(safeReturnPath("javascript:alert(1)")).toBe("/");
    expect(safeReturnPath("/javascript:alert(1)")).toBe("/");
  });

  it("refuses a bare relative path, which is ambiguous", () => {
    expect(safeReturnPath("accounting/invoices")).toBe("/");
  });
});
