#!/usr/bin/env node
import { execFileSync } from "node:child_process";

function runAudit() {
  try {
    return {
      exitCode: 0,
      report: JSON.parse(execFileSync("npm", ["audit", "--omit=optional", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      })),
    };
  } catch (error) {
    const stdout = error.stdout?.toString() ?? "";
    try {
      return { exitCode: error.status ?? 1, report: JSON.parse(stdout) };
    } catch {
      console.error("npm audit konnte nicht als JSON gelesen werden.");
      if (stdout) console.error(stdout);
      if (error.stderr) console.error(error.stderr.toString());
      process.exit(error.status ?? 1);
    }
  }
}

const { exitCode, report } = runAudit();
const counts = report.metadata?.vulnerabilities ?? {};
const total = counts.total ?? 0;

console.log(
  `npm audit: ${total} Schwachstelle(n) ` +
    `(critical=${counts.critical ?? 0}, high=${counts.high ?? 0}, ` +
    `moderate=${counts.moderate ?? 0}, low=${counts.low ?? 0})`,
);

if (total > 0 || exitCode !== 0) {
  console.error("Sicherheitsprüfung fehlgeschlagen. Details: npm audit --omit=optional");
  process.exit(1);
}

console.log("Sicherheitsprüfung bestanden: keine npm-Schwachstellen gefunden.");
