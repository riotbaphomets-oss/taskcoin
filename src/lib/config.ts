// Zentrale Regeln der Plattform. Werte hier ändern, nicht im Code verstreut.
export const FEE_PERCENT = 10; // Gebühr, vom Worker-Anteil abgezogen
export const HOLD_DAYS = 3; // Wartezeit, bis genehmigte Coins verfügbar sind
export const REVIEW_DAYS = 3; // danach werden offene Einreichungen automatisch genehmigt
export const PLATFORM_EMAIL = "platform@taskcoin.local";

export const feeFor = (reward: number) => Math.floor((reward * FEE_PERCENT) / 100);
export const netFor = (reward: number) => reward - feeFor(reward);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

// Phase 4: Zahlungen
export const COINS_PER_EURO = 1000; // Auszahlungskurs
export const MIN_PAYOUT_COINS = 10_000; // = 10 €
export const KYC_THRESHOLD_COINS = 100_000; // = 100 €, darüber Identitätsprüfung nötig
export const COIN_PACKAGES = [
  { id: "s", coins: 10_000, cents: 999 },
  { id: "m", coins: 50_000, cents: 4499 },
  { id: "l", coins: 100_000, cents: 7999 },
  { id: "xl", coins: 500_000, cents: 34_999 },
] as const;

export const payoutCents = (coins: number) => Math.floor((coins * 100) / COINS_PER_EURO);
export const eur = (cents: number) =>
  (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
export const paymentsSimulated = () => process.env.PAYMENTS_MODE === "simulated";

export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
