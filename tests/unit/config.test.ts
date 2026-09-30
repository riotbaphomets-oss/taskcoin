import { describe, expect, it } from "vitest";
import { COINS_PER_EURO, feeFor, FEE_PERCENT, netFor, payoutCents } from "@/lib/config";

describe("Gebühr", () => {
  it("berechnet 10 % und rundet zugunsten des Workers ab", () => {
    expect(FEE_PERCENT).toBe(10);
    expect(feeFor(1000)).toBe(100);
    expect(feeFor(15)).toBe(1);
    expect(feeFor(9)).toBe(0);
    expect(feeFor(1)).toBe(0);
  });

  it("Worker-Anteil plus Gebühr ergibt immer genau die Belohnung", () => {
    for (let reward = 1; reward <= 5000; reward++) {
      expect(netFor(reward) + feeFor(reward)).toBe(reward);
      expect(netFor(reward)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Auszahlungskurs", () => {
  it("rechnet Coins in Cent um", () => {
    expect(COINS_PER_EURO).toBe(1000);
    expect(payoutCents(10_000)).toBe(1000);
    expect(payoutCents(24_850)).toBe(2485);
    expect(payoutCents(999)).toBe(99);
  });
});
