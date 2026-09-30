# TaskCoin – Deployment-Vorbereitung

Die Anwendung ist für eine dauerhafte Bereitstellung vorbereitet, aber **noch nicht veröffentlicht**.

## Technischer Stand

- Next.js `16.3.7`
- Node.js `22`
- Prisma `5.22.0`
- PostgreSQL
- Produktions-Container über `Dockerfile`
- Healthcheck: `GET /api/health`
- Sicherheitsprüfung: `npm run security:audit`

## Benötigte Produktionsvariablen

Nie in Git committen. Im Zielhost als geschützte Umgebungsvariablen hinterlegen:

```env
DATABASE_URL="postgresql://..."
AUTH_SECRET="mindestens 32 zufällige Zeichen"
ADMIN_EMAIL="..."
ADMIN_PASSWORD="mindestens 10 Zeichen"
CRON_SECRET="zufälliges Geheimnis"
PAYMENTS_MODE="simulated"
APP_URL="https://deine-domain.example"
RESEND_API_KEY=""
MAIL_FROM="TaskCoin <noreply@deine-domain.example>"
```

Für einen echten Produktivbetrieb muss `PAYMENTS_MODE` auf einen echten, geprüften Zahlungsanbieter umgestellt werden. Der aktuelle `simulated`-Modus bewegt kein echtes Geld.

## Container lokal prüfen

```bash
docker build -t taskcoin:production .
docker run --rm -p 3000:3000 --env-file .env taskcoin:production
curl http://localhost:3000/api/health
```

Erwartete Antwort:

```json
{"status":"ok"}
```

## Datenbank vor dem ersten Start

Die erste Migration ist im Ordner `prisma/migrations` abgelegt. Im Zielsystem ausführen:

```bash
npx prisma migrate deploy
npm run db:seed
```

Danach den Container starten. Für spätere Releases reicht `npx prisma migrate deploy` vor dem Neustart.

## Go-Live-Checkliste

- [ ] Zielhost und gewünschte Domain festgelegt.
- [ ] TLS/HTTPS aktiviert.
- [ ] PostgreSQL-Datenbank erstellt und Backups eingerichtet.
- [ ] Alle Produktionsvariablen als Secrets hinterlegt.
- [ ] `AUTH_SECRET`, `CRON_SECRET` und Admin-Passwort neu erzeugt.
- [ ] `APP_URL` entspricht exakt der öffentlichen HTTPS-Adresse.
- [ ] `npx prisma migrate deploy` erfolgreich ausgeführt.
- [ ] `npm run security:audit` meldet 0 Schwachstellen.
- [ ] `npm test` besteht mit 42 Tests.
- [ ] `npm run build` besteht.
- [ ] `GET /api/health` liefert HTTP 200.
- [ ] Cron-Aufruf für `/api/cron/auto-approve` ist mit `Authorization: Bearer $CRON_SECRET` eingerichtet.
- [ ] Der Vitest-UI-Server und Debug-Endpunkte sind nicht öffentlich erreichbar.
- [ ] Vor echtem Geld: Zahlungsanbieter, Identitätsprüfung, Recht, Steuer, AGB und Betrugsschutz geprüft.

## Noch nicht ausgeführt

Die Veröffentlichung auf einer dauerhaften Domain wurde bewusst nicht ausgelöst. Dafür fehlen noch die verbindlichen Angaben zum Zielhost, zur Domain und zu den Produktions-Secrets.
