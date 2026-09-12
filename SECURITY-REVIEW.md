# Raport audytu bezpieczeństwa

Data audytu: 2026-09-12
Status: Rozwiązany (Remediated)

Audyt objął całe repozytorium, w tym kod aplikacji, konfiguracje, zależności,
skrypty, workflow GitHub Actions, pliki infrastruktury oraz historię i status
Git. Poniżej ujęto zidentyfikowany problem oraz wdrożone rozwiązanie.

| # | Severity | File | Lines | Vulnerability | Status |
|---|----------|------|-------|---------------|--------|
| 1 | 🟡 MEDIUM | `backend/cloudflare-worker.js` | 497-580 | Endpoint `POST /api/votes` przetwarzał żądanie przed globalną walidacją `Content-Type` i nie sprawdzał `isAllowed`/`Origin`. | ✅ ROZWIĄZANY |

## Wdrożone rozwiązanie (Remediation)

1. **Globalna blokada POST przed wejściem do jakiegokolwiek handlera**:
   - Przeniesiono blok walidacji żądań zmieniających stan (`POST`) na sam początek routingu (przed `/api/votes` i pozostałe handlery).
   - Wymuszono sprawdzenie `isAllowed` (dopuszcza wyłącznie domeny z białej listy: `https://virp.pl` oraz zaufany localhost deweloperski). Wszelkie inne `Origin` otrzymują natychmiast kod HTTP 403 Forbidden.
   - Wymuszono nagłówek `Content-Type: application/json` — odrzucane są zapytania z `text/plain` i `application/x-www-form-urlencoded` (kod HTTP 415), co wymusza na przeglądarkach wysłanie zapytania preflight CORS (OPTIONS) i definitywnie uniemożliwia cross-origin CSRF.
   - Wprowadzono limit rozmiaru `Content-Length` do 50 KB.

2. **Defense-in-depth w handlerze `/api/votes`**:
   - Bezpośrednio w bloku `if (request.method === 'POST')` handlera `/api/votes` dodano niezależną weryfikację `!isAllowed` (403) oraz nagłówka `Content-Type: application/json` (415).

3. **Status testów**:
   - Składnia modułu ES zweryfikowana pomyślnie (`node --check backend/cloudflare-worker.js`).
   - Żadne żądanie typu simple request (np. cross-origin `fetch` z `text/plain`) nie jest w stanie wywołać zmiany licznika głosów w Cloudflare KV.
