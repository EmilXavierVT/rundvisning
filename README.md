# Ungdomsøen Rundtur

Hugo-site til en guidet rundtur på Ungdomsøen med anonyme gruppesvar, der kan deles live mellem gæster på GitHub Pages.

## Lokal udvikling

Kør:

```bash
hugo server
```

Byg produktion:

```bash
hugo --minify
```

## GitHub Pages

Der ligger allerede en workflow-fil i `.github/workflows/hugo.yml`.

Når repoet ligger på GitHub:

1. Push til `main`.
2. Gå til `Settings -> Pages`.
3. Vælg `GitHub Actions` som source.

## Supabase-opsætning

Sitet er statisk, så delte svar kræver en ekstern database. Her bruges Supabase.

1. Opret et Supabase-projekt.
2. Kør SQL'en i `supabase/schema.sql` i Supabase SQL Editor.
3. Gå til `Project Settings -> API`.
4. Kopiér:
   - `Project URL`
   - `anon public key`
5. Indsæt dem i `static/js/supabase-config.js`:

```js
window.SUPABASE_CONFIG = {
  url: "https://dit-projekt.supabase.co",
  anonKey: "din-anon-key"
};
```

6. I Supabase skal realtime være aktiv for tabellen `answers`.

## Sådan virker det

1. Gruppen vælger en fælles turkode.
2. Hver gæst skriver et svar på sin egen telefon.
3. Når de trykker `Del med gruppen`, bliver svaret gemt i Supabase.
4. Alle med samme turkode ser svarene live under det relevante spørgsmål.

## Vigtigt

- Svar er anonyme.
- Alle, der kender turkoden, kan læse og skrive svar til den kode.
- `Download svar` henter brugerens lokale kladder fra den aktuelle enhed.
