import { describe, expect, it } from "vitest";

import { composeHref, composeReturnPath, safeComposeReturn } from "@/utilities/compose-navigation";

const QUEUE_PATH = "/candidates/application-1?position=position-1&unseen=1&queue=stage-1";

describe("composeHref", () => {
  it("opens the composer for the candidate alone when there is nowhere to return to", () => {
    expect(composeHref("application-1")).toBe("/compose?applicationId=application-1");
    expect(composeHref("application-1", null)).toBe("/compose?applicationId=application-1");
  });

  it("carries the return location so it survives the round trip", () => {
    const href = composeHref("application-1", QUEUE_PATH);
    const params = new URL(href, "http://localhost").searchParams;

    expect(params.get("applicationId")).toBe("application-1");
    expect(params.get("returnTo")).toBe(QUEUE_PATH);
  });
});

describe("safeComposeReturn", () => {
  it("accepts this candidate's profile with its screening context", () => {
    expect(safeComposeReturn(QUEUE_PATH, "application-1")).toBe(QUEUE_PATH);
  });

  it("accepts this candidate's profile without a query", () => {
    expect(safeComposeReturn("/candidates/application-1", "application-1")).toBe(
      "/candidates/application-1",
    );
  });

  it("rejects another candidate's profile", () => {
    expect(
      safeComposeReturn("/candidates/application-2?queue=stage-1", "application-1"),
    ).toBeNull();
    expect(safeComposeReturn("/candidates/application-10", "application-1")).toBeNull();
    expect(safeComposeReturn("/candidates/application-1/notes", "application-1")).toBeNull();
  });

  it("rejects other pages in the app", () => {
    expect(safeComposeReturn("/positions", "application-1")).toBeNull();
    expect(safeComposeReturn("/candidates", "application-1")).toBeNull();
    expect(safeComposeReturn("/candidates/../positions/application-1", "application-1")).toBeNull();
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(
      safeComposeReturn("https://example.com/candidates/application-1", "application-1"),
    ).toBeNull();
    expect(safeComposeReturn("//example.com/candidates/application-1", "application-1")).toBeNull();
    expect(
      safeComposeReturn("/\\example.com/candidates/application-1", "application-1"),
    ).toBeNull();
    expect(safeComposeReturn("/\t/example.com", "application-1")).toBeNull();
  });

  it("rejects script URLs", () => {
    expect(safeComposeReturn("javascript:alert(1)", "application-1")).toBeNull();
    expect(safeComposeReturn("javascript:/candidates/application-1", "application-1")).toBeNull();
  });

  it("rejects an empty location", () => {
    expect(safeComposeReturn(null, "application-1")).toBeNull();
    expect(safeComposeReturn("", "application-1")).toBeNull();
    expect(safeComposeReturn("/candidates/", "")).toBeNull();
  });
});

describe("composeReturnPath", () => {
  it("returns to the validated location", () => {
    expect(composeReturnPath(QUEUE_PATH, "application-1")).toBe(QUEUE_PATH);
  });

  it("falls back to the plain profile when the location is not allowed", () => {
    expect(composeReturnPath("https://example.com", "application-1")).toBe(
      "/candidates/application-1",
    );
    expect(composeReturnPath(null, "application-1")).toBe("/candidates/application-1");
  });
});
