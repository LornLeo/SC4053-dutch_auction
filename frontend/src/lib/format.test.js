import { describe, expect, it } from "vitest";
import { Interface } from "ethers";
import { formatCountdown, formatEth, formatTokens, shortAddr } from "./format.js";
import { decodeError, isNodeUnreachable } from "./errors.js";

describe("isNodeUnreachable (ISSUE-010)", () => {
  it("treats the proxy's 500 for a stopped node as unreachable", () => {
    // Exact shape seen in the E2E run with the node stopped behind the Vite proxy.
    expect(isNodeUnreachable({ code: "SERVER_ERROR", shortMessage: "server response 500 Internal Server Error" })).toBe(true);
    expect(isNodeUnreachable({ code: "NETWORK_ERROR" })).toBe(true);
    expect(isNodeUnreachable(new TypeError("Failed to fetch"))).toBe(true);
  });
  it("does not hide contract or call errors", () => {
    expect(isNodeUnreachable({ code: "CALL_EXCEPTION", shortMessage: "execution reverted" })).toBe(false);
    expect(isNodeUnreachable({ code: "BAD_DATA" })).toBe(false);
  });
});

describe("format", () => {
  it("truncates (never rounds up) and groups thousands", () => {
    expect(formatEth(1_234_567_890_000_000_000_000n)).toBe("1,234.5678");
    expect(formatEth(999_999_999_999_999_999n)).toBe("0.9999");
    expect(formatTokens(385_989_394_362_266_257_326n)).toBe("385.98");
    expect(formatEth(0n, 2)).toBe("0.00");
  });
  it("formats countdowns as mm:ss", () => {
    expect(formatCountdown(1200n)).toBe("20:00");
    expect(formatCountdown(65n)).toBe("01:05");
    expect(formatCountdown(0n)).toBe("00:00");
  });
  it("shortens addresses", () => {
    expect(shortAddr("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toBe("0xf39F…2266");
  });
});

describe("decodeError", () => {
  const iface = new Interface(["error NothingToClaim()", "error AuctionNotActive()"]);
  it("reports a wallet rejection as cancelled, not as a failure", () => {
    expect(decodeError({ code: "ACTION_REJECTED" }, iface).cancelled).toBe(true);
    expect(decodeError({ info: { error: { code: 4001 } } }, iface).cancelled).toBe(true);
  });
  it("uses ethers' decoded revert name when present", () => {
    expect(decodeError({ revert: { name: "AuctionNotActive" } }, iface).name).toBe("AuctionNotActive");
  });
  it("finds nested revert data and maps it to a plain-English message", () => {
    const data = iface.encodeErrorResult("NothingToClaim", []);
    const d = decodeError({ info: { error: { data: { data } } } }, iface);
    expect(d.name).toBe("NothingToClaim");
    expect(d.message).toBe("Nothing to claim for this address.");
  });
  it("falls back to the short message", () => {
    expect(decodeError({ shortMessage: "insufficient funds" }, iface).message).toBe("insufficient funds");
  });
});
