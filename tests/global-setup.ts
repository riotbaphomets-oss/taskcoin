import { execSync } from "node:child_process";
import { loadEnv } from "vite";

// Läuft einmal vor allen Tests: prüft die Test-Datenbank und legt das Schema an.
export default function setup() {
  const url = loadEnv("test", process.cwd(), "").TEST_DATABASE_URL || process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL fehlt. In .env.test eintragen, z. B. TEST_DATABASE_URL="postgresql://taskcoin:taskcoin@localhost:5433/taskcoin_test" (siehe README, Abschnitt Tests).',
    );
  }
  // Sicherung: Die Tests leeren alle Tabellen. Sie laufen nur gegen eine Datenbank mit "test" im Namen.
  const dbName = new URL(url).pathname.replace("/", "");
  if (!dbName.includes("test")) {
    throw new Error(`Abbruch: Die Datenbank "${dbName}" hat kein "test" im Namen. Die Tests würden alle Daten löschen.`);
  }
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
