import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { errorMessage } from "./api";
import { initials, isOverdue, parseDate, timeAgo } from "./format";

describe("parseDate", () => {
  it("treats zone-less timestamps as UTC", () => {
    expect(parseDate("2026-10-25 08:00:00").toISOString()).toBe("2026-10-25T08:00:00.000Z");
    expect(parseDate("2026-10-25T08:00:00+02:00").toISOString()).toBe("2026-10-25T06:00:00.000Z");
  });

  it("keeps date-only values on the local calendar day", () => {
    const d = parseDate("2026-10-25");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 25]);
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-10-25T12:00:00Z");
  it.each([
    ["2026-10-25T11:59:30Z", "just now"],
    ["2026-10-25T11:00:00Z", "1 hour ago"],
    ["2026-10-22T12:00:00Z", "3 days ago"],
  ])("%s -> %s", (input, expected) => {
    expect(timeAgo(input, now)).toBe(expected);
  });
});

describe("isOverdue", () => {
  it("is false without a due date or once done", () => {
    expect(isOverdue(null, "todo")).toBe(false);
    expect(isOverdue("2000-01-01", "done")).toBe(false);
  });
  it("flags past due dates on open issues", () => {
    expect(isOverdue("2000-01-01", "in_progress")).toBe(true);
    expect(isOverdue("2999-01-01", "todo")).toBe(false);
  });
});

describe("initials", () => {
  it.each([
    ["Priya Sharma", "PS"],
    ["marcus", "M"],
    ["demo@devtrack.dev", "DD"],
  ])("%s -> %s", (name, expected) => expect(initials(name)).toBe(expected));
});

describe("errorMessage", () => {
  const axiosError = (status: number, data: unknown) =>
    new AxiosError("fail", "ERR", undefined, undefined, {
      status,
      data,
      statusText: "",
      headers: {},
      config: { headers: new AxiosHeaders() },
    });

  it("uses FastAPI's string detail", () => {
    expect(errorMessage(axiosError(409, { detail: "Email already registered" }))).toBe(
      "Email already registered",
    );
  });

  it("formats validation errors with the field name", () => {
    const err = axiosError(422, { detail: [{ loc: ["body", "title"], msg: "too short" }] });
    expect(errorMessage(err)).toBe("title: too short");
  });

  it("reports network failures", () => {
    expect(errorMessage(new AxiosError("Network Error", "ERR_NETWORK"))).toBe(
      "Cannot reach the server",
    );
  });

  it("falls back for unknown errors", () => {
    expect(errorMessage(new Error("boom"), "Nope")).toBe("Nope");
  });
});
