# TaskCoin – Phase 1 bis 4 (Zahlungen simuliert) plus Kontosicherheit

Next.js 14 (App Router) · TypeScript · PostgreSQL · Prisma

## Enthalten
- Registrierung und Login (E-Mail + Passwort, bcrypt, Session per HttpOnly-Cookie/JWT)
- Rollen: WORKER, CLIENT, ADMIN mit Routenschutz (Middleware + Datenbankprüfung)
- Wallet pro Nutzer mit Ledger-Tabelle (Kontostand = Summe der Einträge, noch ohne Buchungslogik)
- Dashboards für alle drei Rollen (Platzhalter), Admin sieht Nutzerzahlen und neueste Konten

## Phase 2: Kampagnen und Escrow
- Auftraggeber legt Kampagne an (Titel, Beschreibung, Coins pro Aufgabe, Plätze)
- Beim Start wird das Gesamtbudget im Ledger gesperrt (ESCROW_LOCK), nur bei ausreichendem Guthaben
- Worker reicht eine Antwort ein (eine Einreichung pro Kampagne, ein Platz pro Einreichung)
- Auftraggeber genehmigt (Coins gehen ans Worker-Wallet) oder lehnt ab (Platz wird wieder frei)
- Kampagne beenden bucht nicht vergebene Plätze zurück (ESCROW_RELEASE)
- Alle Geldbewegungen laufen in Serializable-Transaktionen
- Zum Testen: Admin kann unter „Test-Coins vergeben“ Guthaben gutschreiben

## Phase 3: Wartezeit, Auto-Freigabe, Gebühr
Regeln stehen in `src/lib/config.ts` (Gebühr 10 %, Wartezeit 3 Tage, Auto-Freigabe nach 3 Tagen).
- Genehmigung bucht den Worker-Anteil als PENDING mit `availableAt`, die Gebühr geht auf ein gesperrtes Plattformkonto (Typ FEE)
- Nach Ablauf der Wartezeit zählen die Coins als verfügbar, das Ledger wird dafür nicht verändert
- Offene Einreichungen werden nach Ablauf der Frist automatisch genehmigt: Endpunkt `GET /api/cron/auto-approve` mit `Authorization: Bearer $CRON_SECRET`, stündlich per Cron aufrufen (bei Vercel als Cron-Job eintragen)
- Admin kann die Auto-Freigabe zum Testen von Hand starten

## Phase 4: Coin-Kauf und Auszahlung (Testmodus)
Mit `PAYMENTS_MODE="simulated"` in der `.env` sind Kauf und Auszahlung Test-Funktionen. Es fließt kein echtes Geld.
- Auftraggeber kaufen Coin-Pakete (`/client/wallet`), Worker fragen Auszahlungen an (`/worker/wallet`)
- Nur Auftraggeber können Coins kaufen, nur Worker können auszahlen. Coins wandern also nur über genehmigte Aufgaben vom einen zum anderen.
- Auszahlung: Mindestbetrag 10 €, Kurs 1.000 Coins = 1 €, Coins werden bei der Anfrage sofort abgebucht
- Über 100 € ist eine Identitätsprüfung nötig (im Test setzt der Admin „geprüft“ von Hand)
- Admin markiert Auszahlungen als bezahlt oder lehnt ab (dann werden die Coins zurückgebucht)
- Kaufabschluss läuft über `completePurchaseInTx` (idempotent), dort hängt später der Zahlungs-Webhook dran

Vor echtem Geld: Rechtsprüfung (Zahlungsdienst/E-Geld), echter Zahlungsanbieter, echte Identitätsprüfung, Steuer, AGB.

## Kontosicherheit
- **E-Mail-Bestätigung:** Ohne bestätigte Adresse gibt es nur die Seite „E-Mail bestätigen“, keine Kampagnen, Einreichungen oder Auszahlungen
- **Passwort-Reset:** Einmal-Link, 60 Minuten gültig, Antwort verrät nicht, ob ein Konto existiert. Nach dem Reset sind alle alten Sitzungen ungültig
- **Rate-Limiting** (Tabelle `RateLimit`, kein Redis nötig): Login 8 Versuche pro E-Mail und 30 pro IP in 15 Minuten, Registrierung 5 pro IP und Stunde, Reset-Anfragen 3 pro E-Mail und 5 pro IP und Stunde, Bestätigungsmails 3 pro Konto und Stunde
- Tokens werden nur als Hash gespeichert
- E-Mail-Versand über Resend (`RESEND_API_KEY`, `MAIL_FROM`). Ohne Key erscheint der Link nur in der Entwicklung im Server-Terminal
- Die IP kommt aus `x-forwarded-for`. Das ist nur sicher hinter einem vertrauenswürdigen Proxy (z. B. Vercel)
- Der stündliche Cron räumt abgelaufene Limits und alte Tokens auf

## Entwicklung in GitHub Codespaces (z. B. vom Handy)
Prisma und Docker laufen nicht nativ in Termux (Android). In Codespaces (echtes Linux im Browser) klappt alles:
ZIP hochladen und entpacken, `cp .env.example .env`, `docker compose up -d`, `npm install`, `npx prisma migrate dev --name init`, `npm run db:seed`, `npm run dev`.
In der `.env` `APP_URL` auf die Codespaces-Adresse setzen: `echo "https://$CODESPACE_NAME-3000.$GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN"`

## Tests
Automatische Tests für die Geld-Logik (`src/lib/money.ts`, `payout.ts`, `payments.ts`): Escrow, Gebühr, Wartezeit, Auto-Freigabe, Beenden und Rückbuchung, Auszahlungen, Coin-Kauf und die Buchhaltungs-Regel „jede Kampagne geht auf 0 auf“. Dazu Tests für gleichzeitige Zugriffe (doppeltes Genehmigen, Überziehen, Überbuchen).
```bash
docker compose up -d testdb
echo 'TEST_DATABASE_URL="postgresql://taskcoin:taskcoin@localhost:5433/taskcoin_test"' > .env.test
npm install
npx prisma generate
npm test
```
Die Tests legen das Schema selbst an und **leeren alle Tabellen**. Sie laufen nur gegen eine Datenbank, in deren Namen „test“ vorkommt.

## Start
```bash
cp .env.example .env        # AUTH_SECRET und ADMIN_PASSWORD eintragen
docker compose up -d        # PostgreSQL
npm install
npx prisma migrate dev --name init   # bei Update: --name security
npm run db:seed             # legt Admin und Plattformkonto an (bei Update erneut ausführen)
npm run dev                 # http://localhost:3000
```

## Noch offen (bewusst)
- Echter Zahlungsanbieter, echte Identitätsprüfung, Streitfälle, Betrugsschutz (Mehrfachkonten, Kollusion)
- Rechtliche Prüfung der Coin-Auszahlung vor dem Livegang
