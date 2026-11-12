# Tests von HandScout V1 (Hersteller: Moreno Rossi)

Diese Tests brauchst du nicht, um die App zu benutzen. Sie beweisen, dass alles funktioniert.

```
cd tests
npm install
npx playwright install chromium      # nur für den Browser-Test
node test-db.mjs      # Datenbank + Import + Zugangssperre (ca. 30 s)
node test-last.mjs    # Geschwindigkeit mit 240'000 Testzeilen (ca. 1 Min.)
node e2e.mjs          # echter Browser: Anmelden, alle Seiten, Handy-Format, Offline (ca. 3 Min.)
```

Alle Daten sind **erfunden** (`seed.mjs`, `mock.mjs`). Der Testserver (`server.mjs`) spielt Supabase nach.
