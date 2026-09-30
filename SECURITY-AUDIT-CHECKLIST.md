# Sicherheitsprüfung bei zukünftigen Commits

## Lokaler Pflichtcheck

Vor jedem Commit mit Änderungen an `package.json` oder `package-lock.json`:

```bash
npm install
npm run security:audit
npm test
npm run build
```

`npm run security:audit` schlägt mit Exit-Code 1 fehl, sobald `npm audit` eine Schwachstelle meldet. Die Prüfung verwendet `npm audit --omit=optional --json` und wertet auch Audit-Ausgaben mit Exit-Code 1 korrekt aus.

## CI-Check

In GitHub Actions sollte mindestens ein Job mit folgenden Schritten laufen:

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npm run security:audit
- run: npm test
- run: npm run build
```

Der Job darf nicht mit `continue-on-error: true` konfiguriert werden. So verhindert eine neue Audit-Schwachstelle das Mergen.

## Review-Checkliste

- [ ] `package-lock.json` ist zusammen mit `package.json` aktualisiert.
- [ ] `npm run security:audit` meldet 0 Schwachstellen.
- [ ] Keine ungeprüften `npm audit fix --force`-Änderungen übernommen.
- [ ] Direkte Major-Upgrades wurden im Changelog bzw. Pull Request erläutert.
- [ ] `npm test` besteht vollständig.
- [ ] `npm run build` besteht vollständig.
- [ ] Entwicklungsserver, Vitest-UI und Debug-Endpunkte sind nicht öffentlich erreichbar.
- [ ] Neue `next/image`-Remotequellen sind auf konkrete vertrauenswürdige Domains begrenzt.
- [ ] Server Actions prüfen weiterhin Authentifizierung, Rollen und Eingaben serverseitig.
- [ ] Bei einer bewusst akzeptierten Ausnahme existiert eine dokumentierte Begründung, ein Ablaufdatum und ein Issue zur Behebung.

## Manuelle Detailanalyse

Bei einem Fehlschlag:

```bash
npm audit --omit=optional
npm audit --omit=optional --json > npm-audit.json
npm ls --all
```

Danach die betroffene direkte Abhängigkeit aktualisieren, den Lockfile-Diff prüfen, Tests und Build ausführen und anschließend `npm run security:audit` wiederholen.
