# TaskCoin manuell bei Railway deployen

Diese Anleitung beschreibt die manuelle Verbindung des privaten GitHub-Repositories mit Railway und das anschließende Deployment der TaskCoin-App.

Repository:

- https://github.com/riotbaphomets-oss/taskcoin

Die Anleitung setzt voraus, dass du ein Railway-Konto sowie Zugriff auf das GitHub-Konto `riotbaphomets-oss` hast.

> **Wichtig:** Für die folgenden Schritte werden keine Zugangsdaten im Chat benötigt. Passwörter, API-Keys und Secrets ausschließlich direkt in Railway eintragen.

---

## 1. Railway öffnen und anmelden

1. Öffne auf deinem eigenen Gerät: [railway.com](https://railway.com/).
2. Klicke auf **Login**.
3. Wähle **Continue with GitHub**.
4. Falls GitHub nach einer Autorisierung fragt, bestätige den Zugriff für Railway.
5. Falls das Repository nicht sichtbar ist, öffne in GitHub:
   - **Settings**
   - **Applications**
   - **Installed GitHub Apps**
   - Railway auswählen
   - Zugriff auf das Repository `riotbaphomets-oss/taskcoin` erlauben

---

## 2. Neues Railway-Projekt aus GitHub anlegen

1. In Railway auf **New Project** klicken.
2. **Deploy from GitHub Repo** bzw. **GitHub Repository** auswählen.
3. Das Repository auswählen:

   ```text
   riotbaphomets-oss/taskcoin
   ```

4. Den Branch `main` auswählen.
5. Das Projekt beispielsweise `taskcoin-production` nennen.
6. Den ersten Deployment-Vorgang abwarten.

Der erste Build kann zunächst fehlschlagen, weil noch keine `DATABASE_URL` gesetzt ist. Das ist erwartbar. Die Datenbank wird im nächsten Schritt hinzugefügt.

---

## 3. PostgreSQL-Datenbank hinzufügen

1. Im Railway-Projekt auf **New** oder **+ New** klicken.
2. **Database** auswählen.
3. **PostgreSQL** auswählen.
4. Warten, bis der PostgreSQL-Service bereit ist.

Railway stellt für den PostgreSQL-Service unter anderem diese Variablen bereit:

```text
DATABASE_URL
PGHOST
PGPORT
PGUSER
PGPASSWORD
PGDATABASE
```

Für Prisma wird in TaskCoin `DATABASE_URL` verwendet.

---

## 4. Datenbank mit dem TaskCoin-Service verbinden

1. Den TaskCoin-App-Service auswählen, nicht den PostgreSQL-Service.
2. Den Bereich **Variables** öffnen.
3. Eine neue Variable anlegen:

   **Name**

   ```text
   DATABASE_URL
   ```

   **Wert**

   ```text
   ${{Postgres.DATABASE_URL}}
   ```

4. Falls der Datenbank-Service anders heißt, den tatsächlichen Service-Namen verwenden, zum Beispiel:

   ```text
   ${{PostgreSQL.DATABASE_URL}}
   ```

5. Speichern und die Variable prüfen.

> Railway-Referenzvariablen sind besser als das Kopieren eines festen Passworts, weil sie bei einer Änderung der Datenbankzugangsdaten automatisch aktualisiert werden.

---

## 5. Produktionsvariablen hinterlegen

Im TaskCoin-App-Service unter **Variables** diese Werte anlegen:

```env
NODE_ENV=production
AUTH_SECRET=<zufälliger Wert mit mindestens 32 Zeichen>
ADMIN_EMAIL=<deine Admin-E-Mail-Adresse>
ADMIN_PASSWORD=<neues starkes Admin-Passwort>
CRON_SECRET=<zufälliger Wert mit mindestens 16 Zeichen>
PAYMENTS_MODE=simulated
APP_URL=https://<wird später eingetragen>
RESEND_API_KEY=
MAIL_FROM=TaskCoin <noreply@deine-domain.example>
```

Secrets lokal erzeugen, falls OpenSSL verfügbar ist:

```bash
openssl rand -base64 48
openssl rand -base64 32
```

Die Ergebnisse beispielsweise verwenden als:

```env
AUTH_SECRET=<erste Ausgabe>
CRON_SECRET=<zweite Ausgabe>
```

### Hinweise zu den Variablen

- `AUTH_SECRET`: niemals ändern, solange bestehende Sessions gültig bleiben sollen.
- `ADMIN_PASSWORD`: das bisherige Demo-Passwort nicht wiederverwenden.
- `CRON_SECRET`: wird für den geschützten Auto-Approve-Aufruf benötigt.
- `PAYMENTS_MODE=simulated`: aktiviert weiterhin nur simulierte Zahlungen. Es wird kein echtes Geld bewegt.
- `RESEND_API_KEY`: leer lassen, wenn zunächst keine echte E-Mail-Zustellung eingerichtet wird.
- `MAIL_FROM`: nur eine Domain verwenden, die beim Mailanbieter korrekt eingerichtet ist.

---

## 6. Pre-deploy-Migration einrichten

Damit jede neue Version die Prisma-Migrationen automatisch vor dem Start anwendet:

1. Im TaskCoin-Service **Settings** öffnen.
2. Zum Bereich **Deploy** gehen.
3. Das Feld **Pre-deploy Command** suchen.
4. Folgenden Befehl eintragen:

   ```bash
   npx prisma migrate deploy
   ```

5. Speichern.

Die vorhandene Migration ist eine Baseline-Migration. Sie wurde aus dem aktuellen Prisma-Schema erstellt, ohne die bestehende Datenbank zu löschen.

---

## 7. Einmaliges Seed-Daten-Setup

Die Seed-Datei legt den initialen Admin an. Sie darf nicht bei jedem Deployment automatisch ausgeführt werden, da sie nicht als regulärer Deployment-Schritt gedacht ist.

Für die einmalige Ausführung gibt es zwei Möglichkeiten:

### Möglichkeit A: Railway Shell

1. TaskCoin-Service öffnen.
2. **Deployments** oder **Shell** öffnen, je nach Railway-Oberfläche.
3. In der laufenden Service-Umgebung ausführen:

   ```bash
   npm run db:seed
   ```

### Möglichkeit B: Railway CLI

Falls du die Railway CLI lokal verwendest:

```bash
railway login
railway link
railway run npm run db:seed
```

Danach mit `ADMIN_EMAIL` und `ADMIN_PASSWORD` anmelden.

> Falls der Seed meldet, dass der Admin bereits existiert, ist das kein Fehler. Dann wurde der Seed bereits ausgeführt.

---

## 8. Deployment auslösen

1. Im TaskCoin-Service den Bereich **Deployments** öffnen.
2. **Deploy** oder **Redeploy** auswählen.
3. Die Build- und Deploy-Logs öffnen.
4. Auf folgende Schritte achten:

   ```text
   npm ci
   npx prisma migrate deploy
   npm run build
   server.js
   ```

Ein erfolgreicher Start sollte keinen Fehler wegen fehlender `DATABASE_URL`, `AUTH_SECRET` oder Prisma-Migrationen enthalten.

Das Projekt enthält bereits ein `Dockerfile`. Railway erkennt es automatisch und verwendet den produktiven Next.js-Standalone-Server.

---

## 9. Öffentliche Railway-Domain erzeugen

1. TaskCoin-Service öffnen.
2. **Settings** öffnen.
3. **Networking** auswählen.
4. **Generate Domain** anklicken.
5. Die erzeugte URL kopieren, zum Beispiel:

   ```text
   https://taskcoin-production.up.railway.app
   ```

6. Zurück zu **Variables** gehen.
7. `APP_URL` auf diese HTTPS-Adresse setzen:

   ```env
   APP_URL=https://taskcoin-production.up.railway.app
   ```

8. Erneut deployen.

Keine abschließenden `/` in `APP_URL` verwenden.

---

## 10. Healthcheck testen

Im Browser öffnen:

```text
https://taskcoin-production.up.railway.app/api/health
```

Erwartete Antwort:

```json
{"status":"ok"}
```

Alternativ im Terminal:

```bash
curl -i https://taskcoin-production.up.railway.app/api/health
```

Erwartet wird HTTP `200`.

---

## 11. Login und Registrierung testen

### Admin-Login

1. Öffne:

   ```text
   https://taskcoin-production.up.railway.app/login
   ```

2. Verwende die in Railway hinterlegten Werte:
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
3. Öffne anschließend den Admin-Bereich.

### Registrierung

1. Öffne:

   ```text
   https://taskcoin-production.up.railway.app/register
   ```

2. Registrierung mit einer Testadresse durchführen.
3. Wenn kein echter Mailanbieter hinterlegt ist, den Entwicklungs-Mail-Link in den Logs suchen.

> Für einen echten öffentlichen Betrieb sollte ein Mailanbieter wie Resend korrekt konfiguriert werden. Entwicklungslinks aus Logs sind nicht für einen regulären Nutzerbetrieb geeignet.

---

## 12. Auto-Approve-Cron einrichten

Die Route lautet:

```text
GET /api/cron/auto-approve
```

Sie ist durch `CRON_SECRET` geschützt und erwartet:

```http
Authorization: Bearer <CRON_SECRET>
```

### Empfohlener Zeitplan

Da die automatische Freigabe erst nach mehreren Tagen erfolgt, genügt normalerweise ein täglicher Aufruf, zum Beispiel um 03:00 Uhr.

Verwende entweder:

- Railway Cron/Worker, falls in deinem Tarif und Projekt verfügbar
- einen externen vertrauenswürdigen Scheduler
- einen zweiten kleinen Worker-Service

Beispielaufruf:

```bash
curl -fsS \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "https://taskcoin-production.up.railway.app/api/cron/auto-approve"
```

Das `CRON_SECRET` niemals als URL-Parameter übergeben, weil URLs häufiger in Logs gespeichert werden.

---

## 13. Eigene Domain anschließen (optional)

1. Railway-Service öffnen.
2. **Settings → Networking → Custom Domain** wählen.
3. Die gewünschte Domain eintragen, zum Beispiel:

   ```text
   taskcoin.example.com
   ```

4. Den von Railway angezeigten DNS-Eintrag beim Domainanbieter setzen.
5. Warten, bis DNS und TLS bereit sind.
6. `APP_URL` in Railway ändern:

   ```env
   APP_URL=https://taskcoin.example.com
   ```

7. Erneut deployen.

---

## 14. Sicherheitscheck nach dem Go-Live

Nach der Veröffentlichung prüfen:

- [ ] `/api/health` liefert HTTP 200.
- [ ] `/login` lädt ohne Fehler.
- [ ] Admin-Login funktioniert.
- [ ] Geschützte Bereiche sind ohne Login nicht erreichbar.
- [ ] Registrierung und Verifizierung funktionieren.
- [ ] `DATABASE_URL` ist als Railway-Referenzvariable konfiguriert.
- [ ] Keine `.env`-Datei wurde zu GitHub gepusht.
- [ ] `PAYMENTS_MODE=simulated` ist bewusst gewählt.
- [ ] `CRON_SECRET` ist gesetzt und nicht öffentlich sichtbar.
- [ ] PostgreSQL-Backups und Aufbewahrung sind eingerichtet.
- [ ] Railway-Logs enthalten keine Secrets oder Passwörter.
- [ ] Eine eigene Domain verwendet HTTPS.

---

## 15. Typische Fehler

### Repository wird nicht angezeigt

In GitHub die Railway-App öffnen und Repository-Zugriff auf `riotbaphomets-oss/taskcoin` erlauben. Danach Railway neu laden.

### `DATABASE_URL` fehlt

Prüfen, ob die Variable im **TaskCoin-App-Service** und nicht nur im PostgreSQL-Service gesetzt ist. Die Referenz muss auf den tatsächlichen Datenbank-Service zeigen.

### Prisma-Migration schlägt fehl

Prüfen:

```text
DATABASE_URL
npx prisma migrate deploy
```

Nicht `prisma migrate dev` in Produktion verwenden.

### Build findet `prisma` nicht

Prüfen, ob `prisma` in `dependencies` oder `devDependencies` des `package.json` enthalten ist und ob Railway das Repository vollständig baut.

### Login funktioniert nicht

Prüfen:

- `AUTH_SECRET` gesetzt
- `APP_URL` korrekt und mit `https://`
- Browser-Cookies nicht blockiert
- Railway-Logs auf Serverfehler prüfen

### Healthcheck liefert 503

Dann kann die App die PostgreSQL-Datenbank nicht erreichen. `DATABASE_URL`, Service-Referenz und Datenbankstatus prüfen.

---

## 16. Wichtiger Produktivhinweis

TaskCoin ist aktuell technisch als MVP vorbereitet. `PAYMENTS_MODE=simulated` bedeutet, dass keine echten Zahlungen ausgeführt werden.

Vor dem Betrieb mit echtem Geld müssen zusätzlich geprüft und implementiert werden:

- Zahlungsanbieter und signierte Webhooks
- Idempotenz und Betrugsschutz
- KYC/AML und Auszahlungsregeln
- Datenschutz und Datenaufbewahrung
- rechtliche Anforderungen, AGB und Steuerfragen
- Datenbank-Backups und Restore-Tests
- Monitoring und Alarmierung

Erst nach diesen Prüfungen `PAYMENTS_MODE` auf einen echten Zahlungsmodus umstellen.
