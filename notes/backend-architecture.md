# Notatki Architektury Backendowej VIRP.pl

## 1. Cloudflare Worker Gateway
* **URL:** `https://virp-proxy.chojmarcel.workers.dev/`
* **Plik źródłowy w projekcie:** `backend/cloudflare-worker.js`

### Kluczowe funkcje i zabezpieczenia:
1. **Ochrona SSRF (Biała lista hostów):**
   * Endpoint `GET /api/stats` akceptuje wyłącznie hosty z `ALLOWED_STATS_HOSTS`:
     - `api.strefarp.gg`
     - `servers-frontend.fivem.net`
   * Zapobiega użyciu Workera jako Open Proxy do ataków na obce cele.

2. **Anty-Spam i Rate Limiting:**
   * Limit 5 minut na jedno IP (`CF-Connecting-IP`).
   * Obsługa Cloudflare KV (`env.VIRP_KV`) lub pamięci lokalnej `ipCooldowns` (Map).
   * Automatyczne czyszczenie wygasłych wpisów w Mapie, aby zapobiec wyciekowi pamięci (`ipCooldowns.delete(ip)`).

3. **Autoryzacja Źródeł (Origin Whitelist):**
   * Dozwolone domeny: `https://virp.pl`, `*.virp.pl`, `http://127.0.0.1:5500`, `http://localhost:3000`, `http://localhost:5173`.
   * Bezpośrednie wywołania botów/skryptów bez prawidłowego Originu zwracają `403 Forbidden`.

4. **Strefa Czasowa Discord Embed:**
   * Wymuszenie `timeZone: 'Europe/Warsaw'` w `toLocaleString('pl-PL')` eliminuje przesunięcia UTC.

5. **Sanityzacja Linków:**
   * Wymuszenie protokołów `https://` / `http://` zapobiega atakom XSS (`javascript:...`) w polach Discord i WWW.

6. **Normalizacja Routingu (Trailing Slash):**
   * Sprawdzanie `url.pathname.replace(/\/$/, '') === '/api/stats'` obsługuje bezbłędnie zapytania zarówno do `/api/stats`, jak i `/api/stats/`.

