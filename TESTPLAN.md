# TaskCoin: Testplan (Phase 1 bis 4)

Ziel: einmal den ganzen Kreislauf durchspielen und die erwarteten Zahlen prüfen.
Die Geld-Logik wird zusätzlich automatisch getestet (`npm test`, siehe README). Dieser Plan prüft die Oberfläche und das Zusammenspiel von Hand.
Voraussetzung: App läuft, Migration und `npm run db:seed` sind durch, `PAYMENTS_MODE="simulated"`.

Zum Wechseln zwischen Rollen: jeweils abmelden oder ein privates Fenster nutzen.

Bereits vorhandene Testkonten aus früheren Phasen sind nicht bestätigt. Einmalig freischalten:
```sql
UPDATE "User" SET "emailVerifiedAt" = now() WHERE "emailVerifiedAt" IS NULL;
```

## 1. Konten anlegen
- [ ] Als Admin anmelden (E-Mail und Passwort aus `.env`). Erwartet: Seite „Verwaltung“.
- [ ] Neues Konto „Auftraggeber A“ (Aufgaben einstellen). Erwartet: Seite „E-Mail bestätigen“. Den Link aus dem Server-Terminal (Zeile „Mail, nur Entwicklung“) im Browser öffnen, dann anmelden. Erwartet: Seite „Deine Kampagnen“, Guthaben 0.
- [ ] Neues Konto „Worker B“ (Aufgaben erledigen), ebenso bestätigen. Erwartet: Seite „Deine Aufgaben“, 0 Coins.
- [ ] Passwort mit weniger als 10 Zeichen probieren. Erwartet: Fehlermeldung.

## 2. Zugriffsschutz
- [ ] Als Worker B die Adresse `/client` öffnen. Erwartet: Weiterleitung nach `/worker`.
- [ ] Abgemeldet `/admin` öffnen. Erwartet: Weiterleitung nach `/login`.

## 3. Guthaben und Escrow
- [ ] Admin: „Test-Coins vergeben“ an A: **20000**. Erwartet: Meldung mit Betrag.
- [ ] A: Kampagne „Test 1“, **1000 Coins, 5 Plätze**. Erwartet: Guthaben **15.000**, Buchung „Budget gesperrt −5.000“.
- [ ] A: Kampagne mit 5000 Coins und 10 Plätzen. Erwartet: Fehler „Guthaben reicht nicht“ (50.000 nötig, 15.000 vorhanden), keine neue Kampagne.

## 4. Aufgabe erledigen und prüfen
- [ ] B: Aufgabe „Test 1“ zeigt **900 Coins** (1000 minus 10 % Gebühr) und „Noch 5 Plätze frei“.
- [ ] B: Antwort einreichen. Erwartet: zurück auf die Übersicht, Einreichung „In Prüfung“, Aufgabe nicht mehr in der Liste.
- [ ] B: Aufgabenseite direkt erneut öffnen. Erwartet: „Du hast diese Aufgabe schon eingereicht“.
- [ ] A: Kampagne öffnen. Erwartet: 1 Einreichung, Hinweis auf automatische Genehmigung in 3 Tagen. „Genehmigen“ klicken.
- [ ] B: Erwartet **0 verfügbar, 900 in Wartezeit**, in der Wallet „verfügbar ab (in 3 Tagen)“.
- [ ] Admin: Plattformgebühren **100**.

## 5. Wartezeit abkürzen (nur Test)
In der Datenbank (`npx prisma studio` oder psql):
```sql
UPDATE "LedgerEntry" SET "availableAt" = now() - interval '1 minute' WHERE type = 'EARNING';
```
- [ ] B: Seite neu laden. Erwartet **900 verfügbar, 0 in Wartezeit**.

## 6. Kampagne beenden
- [ ] A: „Test 1“ beenden. Erwartet: Guthaben **19.000** (15.000 plus 4 nicht vergebene Plätze à 1000), Buchung „Budget zurückgebucht +4.000“.

## 7. Auto-Freigabe
- [ ] A: Neue Kampagne „Test 2“, 1000 Coins, 2 Plätze (Guthaben danach 17.000). B reicht ein.
- [ ] Alter der Einreichung setzen:
```sql
UPDATE "Submission" SET "createdAt" = now() - interval '4 days' WHERE status = 'SUBMITTED';
```
- [ ] Admin: „Auto-Freigabe jetzt ausführen“. Erwartet: „1 Einreichung(en) automatisch freigegeben.“
- [ ] B: 900 in Wartezeit, Buchung mit Notiz „Automatisch freigegeben“. Admin: Gebühren jetzt **200**.

## 8. Auszahlung
- [ ] Admin: an B **10000** Test-Coins vergeben (nur um das Minimum zu erreichen).
- [ ] B: Auszahlung **9999** Coins. Erwartet: Fehler „Mindestauszahlung“.
- [ ] B: Auszahlung **10000**, gültige PayPal-E-Mail. Erwartet: Wert 10,00 €, Meldung „angefragt“, Guthaben sinkt um 10.000, Status „In Prüfung“.
- [ ] Admin: „Ablehnen und zurückbuchen“. Erwartet: B hat die 10.000 wieder, Status „Abgelehnt“.
- [ ] B: erneut 10000 anfragen, Admin: „Als bezahlt markieren“. Erwartet: Status „Ausgezahlt“, Coins bleiben abgebucht.

## 9. Identitätsprüfung
- [ ] Admin: B weitere **100000** Coins vergeben. B: Auszahlung **100001**. Erwartet: Fehler „Identitätsprüfung“.
- [ ] Admin: B „Als geprüft markieren“. B: dieselbe Auszahlung erneut. Erwartet: klappt.

## 10. Coin-Kauf (simuliert)
- [ ] A: Wallet, „Testkauf“ beim Paket 10.000 Coins. Erwartet: Guthaben plus 10.000, Buchung „Einzahlung, Coin-Kauf (simulated)“.
- [ ] `PAYMENTS_MODE` auf einen anderen Wert setzen, neu starten. Erwartet: Kauf- und Auszahlungsformulare verschwinden.

## 11. Buchhaltungs-Check (wichtig)
Jede beendete Kampagne muss in der Summe **0** ergeben (gesperrt, zurückgebucht, verdient, Gebühr):
```sql
SELECT "campaignId", SUM(amount) FROM "LedgerEntry"
WHERE "campaignId" IS NOT NULL GROUP BY 1;
```
- [ ] „Test 1“ (beendet): **0**. „Test 2“ (noch aktiv, 1 von 2 Plätzen belegt): **−1000** (der freie Platz ist noch gesperrt).
- [ ] Nach dem Beenden von „Test 2“ ebenfalls **0**.

## 12. Sicherheit
- [ ] Neues Konto anlegen, ohne den Link zu öffnen. Bereich `/worker` aufrufen. Erwartet: Weiterleitung auf „E-Mail bestätigen“. „E-Mail erneut senden“ zweimal klicken. Erwartet: neuer Link im Terminal, der alte funktioniert nicht mehr.
- [ ] Denselben Bestätigungslink zweimal öffnen. Erwartet: beim zweiten Mal „Link nicht gültig“.
- [ ] Anmeldung mit falschem Passwort 9-mal hintereinander. Erwartet: ab dem 9. Versuch „Zu viele Anmeldeversuche“ (für 15 Minuten).
- [ ] „Passwort vergessen“ mit einer bestehenden und einer unbekannten Adresse. Erwartet: beide Male dieselbe Meldung. Nur bei der bestehenden erscheint ein Link im Terminal.
- [ ] Reset-Link öffnen, zu kurzes Passwort eingeben. Erwartet: Fehler, Link bleibt gültig. Dann gültiges Passwort setzen. Erwartet: Login-Seite mit Hinweis „Passwort geändert“.
- [ ] Reset-Link ein zweites Mal öffnen und absenden. Erwartet: „Link ungültig oder abgelaufen“.
- [ ] Vor dem Reset in einem zweiten Browserfenster angemeldet sein. Danach dort eine Seite neu laden. Erwartet: automatische Abmeldung.
- [ ] Mit dem neuen Passwort anmelden. Erwartet: klappt.
- [ ] Rate-Limit-Zähler ansehen: `SELECT * FROM "RateLimit";` Erwartet: Einträge für login, register, forgot.

## Wenn etwas abweicht
Notiere Schritt, erwartetes und tatsächliches Ergebnis (bei Fehlern die Konsolenmeldung) und schick es weiter.
