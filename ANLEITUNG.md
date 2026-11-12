# HandScout V1 – Anleitung zum Einrichten

**Hersteller: Moreno Rossi** · Daten: handball.ch (die letzten 5 Saisons) · Nur du kommst hinein.

Du brauchst keine Programmierkenntnisse. Alles geht im Browser, mit Anklicken und Einfügen. Plane **etwa 45 Minuten** ein. Der erste Datenimport läuft danach von selbst im Hintergrund (das dauert Stunden, du musst nicht dabeibleiben).

Alles kostet **0 Franken**: Supabase (Datenbank), GitHub (Speicher, Automatik und Webseite).

> **Wichtig:** Das ist ein **eigenes, neues** Projekt auf **deinem** Konto. Es hat nichts mit anderen GitHub-Projekten zu tun, und niemand sonst bekommt Zugriff.

---

## Überblick: Wie es funktioniert

1. **Supabase** speichert alle Spiele und Spieler in einer Datenbank. Die Datenbank ist **gesperrt**: Nur wer auf deiner Zugangsliste steht, bekommt Daten (auch wenn jemand den Link kennt).
2. **GitHub** holt jede Nacht automatisch die neuen Spiele von handball.ch und schreibt sie in die Datenbank.
3. **GitHub Pages** zeigt die App unter einem Link. Diesen Link öffnest du auf dem Handy und installierst die App.

Du brauchst für alles zwei Konten (Supabase und GitHub) und denselben Ordner **handscout** aus der ZIP-Datei (entpacken!).

---

## Teil A – Datenbank bei Supabase (15 Min.)

**A1. Konto und Projekt**
1. Gehe auf **supabase.com** → **Start your project** → mit **GitHub** oder E-Mail anmelden.
2. **New project**. Name: `handscout`. **Database Password**: ein langes Passwort wählen und **irgendwo aufschreiben**. Region: eine in **Europa** (z. B. Zürich oder Frankfurt). Plan: **Free**.
3. Warte 1 bis 2 Minuten, bis das Projekt bereit ist.

**A2. Datenbank-Struktur einspielen**
1. Links auf **SQL Editor** → **New query**.
2. Öffne auf deinem Computer die Datei **`supabase/schema.sql`** (Rechtsklick → mit Texteditor öffnen), **alles markieren, kopieren**, im SQL Editor **einfügen**.
3. Unten rechts auf **Run**. Es muss «Success. No rows returned» erscheinen. (Du darfst das später gefahrlos nochmals ausführen.)

**A3. Dein Konto anlegen**
1. Links **Authentication** → **Users** → **Add user** → **Create new user**.
2. Trage **deine E-Mail** und ein **Passwort** ein (das Passwort brauchst du zum Anmelden in der App). Setze den Haken bei **Auto Confirm User**. **Create user**.

**A4. Fremde aussperren**
1. **Authentication** → **Sign In / Providers** (oder «Settings») → bei **Email** den Schalter **«Allow new users to sign up»** (Neue Registrierungen erlauben) **ausschalten**. **Save**.

**A5. Dich auf die Zugangsliste setzen** (das ist die eigentliche Sperre)
1. **SQL Editor** → **New query** → diesen Text einfügen, aber **`DEINE@EMAIL.CH` durch deine E-Mail aus A3 ersetzen** (genau gleich geschrieben):

```sql
insert into zugang(email, name, rolle)
values (lower('DEINE@EMAIL.CH'), 'Moreno Rossi', 'admin')
on conflict (email) do update set rolle = 'admin';
```

2. **Run**. Fertig: Nur diese E-Mail kommt jetzt an die Daten.

**A5b. Kontrolle (empfohlen):** Führe im SQL Editor aus: `select * from zugang;` Du siehst genau eine Zeile mit deiner E-Mail.

**A6. Drei Angaben notieren** (**Project Settings** → **API Keys**, oder oben auf **Connect**):
- **Project URL** (sieht aus wie `https://abcdefgh.supabase.co`)
- **Publishable key** (beginnt mit `sb_publishable_…`; bei älteren Projekten heisst er **anon public**) → **darf in der App stehen**
- **Secret key** (beginnt mit `sb_secret_…`; bei älteren Projekten **service_role**) → **GEHEIM, nie weitergeben**, nur für Teil B

---

## Teil B – GitHub: Speicher, Automatik, Webseite (20 Min.)

**B1. Konto und Projekt**
1. **github.com** → anmelden (oder kostenlos registrieren).
2. Oben rechts **+** → **New repository**. Name: `handscout`. **Public** auswählen (nur so ist die Webseite gratis; die Daten bleiben trotzdem gesperrt). **Create repository**.

**B2. Dateien hochladen**
1. Entpacke die ZIP-Datei auf deinem Computer. Öffne den Ordner **handscout**.
2. Auf der GitHub-Seite des neuen Projekts: **uploading an existing file**. Ziehe den **ganzen Inhalt des Ordners** (alles, was **in** `handscout` liegt) in das Fenster. Warte, bis alles hochgeladen ist. Unten **Commit changes**.
3. **Kontrolle:** Im Projekt müssen diese Einträge sichtbar sein: `index.html`, `config.js`, `js`, `css`, `icons`, `scripts`, `supabase` und **`.github`**.
   - **Fehlt `.github`?** (Versteckte Ordner werden manchmal nicht mitgenommen.) Dann: **Add file → Create new file**, als Dateiname genau `.github/workflows/import-db.yml` eintippen (die Schrägstriche erzeugen die Ordner), und den Inhalt der gleichnamigen Datei aus dem ZIP einfügen → **Commit changes**.

**B3. Geheimnisse hinterlegen** (damit die Automatik in die Datenbank schreiben darf)
1. Im Projekt: **Settings** → links **Secrets and variables** → **Actions** → **New repository secret**.
2. Erstes Secret: Name **`SUPABASE_URL`**, Wert: deine **Project URL**. **Add secret**.
3. Zweites Secret: Name **`SUPABASE_SERVICE_KEY`**, Wert: dein **Secret key** (service_role). **Add secret**.

**B4. Ersten Import starten**
1. Oben **Actions**. Falls ein Knopf **«I understand my workflows, go ahead and enable them»** erscheint: anklicken.
2. Links **«Datenimport in die Datenbank»** → rechts **Run workflow** → grüner Knopf **Run workflow**.
3. Nach ein paar Sekunden erscheint ein Eintrag mit gelbem Punkt (läuft). **Klicke ihn an**, dann auf **import**, um das Protokoll zu sehen. Du siehst Zeilen wie «Saison 26 (aktuell): 40 Gruppen …».
4. Der Import holt **5 Saisons**. Das kann **mehrere Stunden** dauern. Wenn ein Lauf nach 5 Stunden nicht fertig ist, **startet er sich selbst neu** und macht weiter. Du musst nichts tun. Fertig ist es, wenn im Protokoll **«Fertig:»** ohne «Zeitlimit» steht und ein grüner Haken erscheint.
5. Ab jetzt läuft der Import **jede Nacht automatisch** (neue Spiele, neue Spielpläne). Das hält zugleich die Gratis-Datenbank wach.

**B5. App mit deiner Datenbank verbinden**
1. Im Projekt auf die Datei **`config.js`** klicken → oben rechts **Stift-Symbol** (Edit).
2. Ersetze `https://DEIN-PROJEKT.supabase.co` durch deine **Project URL** und `DEIN-ANON-PUBLIC-KEY` durch deinen **Publishable key** (anon). Die Anführungszeichen `'…'` bleiben stehen.
3. **Commit changes**.

**B6. Webseite einschalten**
1. **Settings** → links **Pages** → bei **Source**: **Deploy from a branch** → Branch **main**, Ordner **/ (root)** → **Save**.
2. Nach 1 bis 2 Minuten steht oben auf der Seite dein Link: `https://DEINNAME.github.io/handscout/`.

**B7. Passwort-Zurücksetzen vorbereiten (einmalig)**
In Supabase: **Authentication** → **URL Configuration** → **Site URL**: deinen Link aus B6 einfügen → **Save**.

---

## Teil C – Auf dem Handy benutzen (5 Min.)

1. Öffne deinen Link (B6) im Handy-Browser. Melde dich mit **E-Mail und Passwort aus A3** an.
2. **Android (Chrome):** Menü (⋮) → **App installieren** (oder «Zum Startbildschirm»). Oder in der App: **Einstellungen → Auf dem Handy installieren**.
3. **iPhone (Safari):** unten auf **Teilen** tippen → **Zum Home-Bildschirm**.
4. Die App erscheint mit dem Handball-Symbol. Beim ersten Mal lädt die Datenbank vielleicht noch (Import läuft), das ist normal.

---

## Teil D – Was du in der App kannst

| Bereich | Was drin ist |
|---|---|
| **Suche** | Spieler suchen (Name) mit vielen Filtern: Saison, Geschlecht, Liga, Altersklasse, Jahrgang, Position, Team, Kanton, **Umkreis um Stäfa**, Mindest-Spiele, Würfe, Tore/Spiel, Quote, Strafen. Schnellfilter: Torhüter im Umkreis, Nachwuchs-Talente, Aufsteiger, Versteckte Perlen, Nur Stäfa. Filter **speichern** und per **Link** teilen. Export **CSV / Excel / PDF**. Zweiter Reiter **Teams** (Gegner-Scouting). |
| **Rankings** | Torschützen, Wurfquote, wenig Fehler, Fairste, Torhüter, Aufsteiger, Versteckte Perlen, Entwicklung (Verbesserung zur Vorsaison). |
| **Profil** (Spieler antippen) | Kennzahlen pro Saison, Stärken und Schwächen (Radar), Entwicklung (Diagramme), Karriereweg (Vereins- und Liga-Wechsel), letzte Spiele, ähnliche Spieler, Disziplin, Watchlist mit Sternen, Notizen, Status, Erinnerung, Spieler-Akte (Talent Card, Schule/Lehre, Training, Ziele). |
| **Vergleich** | 2 bis 4 Spieler nebeneinander (Tabelle mit Bestwerten, Radar, Entwicklung). Im Suchresultat das Vergleichs-Symbol antippen. |
| **Watchlist** | Alle gemerkten Spieler mit Status (Beobachten / Kontaktieren / Abgesagt), Sternen, Notizen und fälligen Erinnerungen. |
| **Stäfa** | Nächste Spiele von Handball Stäfa (mit Link zum Gegner-Profil), alle eigenen Spieler inkl. **Nachwuchs bis U13**, Etikett «Nachwuchs/Rookie», Akten, Schnellzugriff «Transfers finden». |
| **Einstellungen** | Hell/Dunkel, Umkreis-Mittelpunkt, gespeicherte Filter, Daten-Status (letzter Import), **Backup**, Über HandScout (Hersteller Moreno Rossi, V1), Datenschutz. |

**Der Score** (grün/rot) vergleicht einen Spieler mit allen Spielern **derselben Liga in derselben Saison**: 0 ist Durchschnitt, +1 ist deutlich besser. Bei wenigen Spielen wird er gedämpft, und unter 3 Spielen (oder zu wenig Würfen) gibt es keinen Score. Warnhinweise («nur 3 Sp.») zeigen kleine Stichproben.

---

## Teil E – Betrieb und Pflege

- **Täglich:** nichts. Der Import läuft nachts. Letzter Import: **Einstellungen → Daten von handball.ch**.
- **Passwort ändern:** Supabase → Authentication → Users → dein Konto → Send password recovery.
- **Freund oder Trainer hinzufügen (später, optional):** Supabase → Authentication → Users → **Add user** (E-Mail und Passwort). Dann im SQL Editor:
  ```sql
  insert into zugang(email, name, rolle) values (lower('freund@mail.ch'), 'Name', 'viewer');
  ```
  Rollen: `viewer` = nur lesen, `trainer` = lesen und Notizen schreiben, `admin` = alles. **Jemanden sperren:** `delete from zugang where email = 'freund@mail.ch';`
- **Backup:** In der App **Einstellungen → Backup** (Watchlist und Akten als Datei) ab und zu laden. Die Spielstatistiken kannst du jederzeit neu importieren.
- **Speicherplatz:** Gratis sind 500 MB. Prüfe ab und zu in Supabase: **Reports → Database** (Grösse). Wird es eng (über 400 MB), im Projekt die Datei `.github/workflows/import-db.yml` bearbeiten und bei `MAX_SAISONS` eine kleinere Zahl eintragen.
- **Datenbank pausiert?** Supabase pausiert Gratis-Projekte nach 7 Tagen ohne Aktivität. Der nächtliche Import zählt als Aktivität. Falls doch einmal pausiert: Supabase → dein Projekt → **Restore project**.
- **Liga-Stufen anpassen:** Supabase → **Table Editor** → Tabelle `liga_stufen` (1 = oberste Stufe). Sie steuern «Aufsteiger» und «Versteckte Perlen». Danach im SQL Editor `select refresh_stats();` ausführen.

---

## Wenn etwas nicht klappt

| Meldung / Problem | Lösung |
|---|---|
| «Fast geschafft … noch nicht mit deiner Datenbank verbunden» | `config.js` nicht angepasst (B5) oder die Seite noch nicht neu geladen. Handy: Seite neu laden. |
| «E-Mail oder Passwort stimmt nicht» | Das Passwort aus A3 verwenden. Im Zweifel in Supabase das Passwort neu setzen. |
| «Kein Zugriff – Konto steht nicht auf der Zugangsliste» | Schritt A5 wiederholen, E-Mail **genau** gleich schreiben wie bei A3. |
| Die Liste ist leer / «Keine Saisons» | Der erste Import ist noch nicht fertig oder fehlgeschlagen. GitHub → Actions → Protokoll ansehen. |
| Import rot («Datenbank (…): HTTP 401/403») | Secret `SUPABASE_SERVICE_KEY` falsch eingefügt (Leerzeichen am Rand? Es muss der **Secret/service_role**-Key sein). |
| Import rot («Keine Saisons gefunden: Abruf von handball.ch nicht möglich») | handball.ch hat den Zugriff verweigert oder die Seite geändert. Später nochmals «Run workflow». Hilft das nicht: Protokoll kopieren und an Claude schicken. |
| Seite zeigt altes Aussehen | Seite im Browser neu laden (Handy: App schliessen und neu öffnen). |
| Excel-Export geht nicht | Dann **CSV** wählen (öffnet sich in Excel). |

---

## Was getestet wurde und was nicht (ehrlich)

**Getestet** (mit einer Datenbank im Speicher und erfundenen Daten, 67 automatische Browser-Prüfungen, dazu Datenbank-Tests und ein Lasttest mit 240'000 Zeilen): Anmeldung und Zugangssperre (Fremde und Konten ohne Eintrag sehen nichts, auch nicht am App-Code vorbei), alle Seiten und Filter, Profil, Vergleich, Watchlist, Akten, Stäfa, Export CSV/Backup, Handy-Layout von 320 bis 768 px (kein seitliches Scrollen), Hell/Dunkel, Offline-Start mit letztem Stand, Import (zweimal laufen lassen erzeugt nichts doppelt, ein fehlerhaftes Spiel wird später erneut versucht).

**Nicht getestet** (ging in meiner Umgebung nicht):
- Der **Abruf bei handball.ch** selbst: Das Matchcenter war von hier nicht erreichbar. Der erste echte Import ist der eigentliche Test. Der Aufbau der Abfragen stammt aus der früheren Version.
- Die **echte Supabase-Cloud**: Getestet wurde dieselbe Datenbank-Technik (Postgres) im Speicher, nicht Supabase selbst.
- **iPhone/Safari**: getestet wurde Chromium im Handy-Format, nicht echte Geräte.
- **Excel-Export** (lädt einen Baustein von cdnjs), **Google-Schriften** (ohne Internet fällt die App auf Standardschriften zurück).
- **Geschlecht und Altersklasse** werden nur aus dem Liga-Namen abgelesen (z. B. «U17», «Damen»). Steht dort nichts, bleibt das Feld leer. Die **Position** liefert handball.ch nicht in allen Ligen. Es wird nichts erfunden.
- **Ältere Saisons** haben bei handball.ch eventuell weniger Details. Fehlendes bleibt leer.

**Rechtliches:** Du nutzt öffentlich sichtbare Daten von handball.ch auf eigenes Risiko und ohne Rückfrage bei Swiss Handball (so hast du es entschieden). Nutze die App nur privat. Bei Nachwuchsspielern (U13 bis U19) nur Notwendiges notieren und nichts weitergeben (Datenschutzgesetz). Löschen auf Wunsch.
