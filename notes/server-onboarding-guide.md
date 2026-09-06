# Procedura Dodawania Nowych Serwerów do VIRP.pl

Ten dokument opisuje standardowy proces dodawania kolejnych serwerów RP do bazy danych, pozyskiwania statystyk graczy na żywo oraz przygotowywania grafik.

---

## 1. Pozyskiwanie API Liczby Graczy Online (Live Tracking)

Gdy dodajemy nowy serwer, próbujemy automatycznie zlokalizować źródło danych w czasie rzeczywistym:

1. **Wewnętrzne API strony serwera (Priorytet):**
   * Badamy skrypty JS strony głównej (np. aplikacje Next.js / Nuxt / React).
   * Przykład (Strefa RP): Odnaleziono oficjalny endpoint produkcyjny:
     `https://api.strefarp.gg/api/stats` -> `{ "players_online": 161, "in_queue": 0 }`.
   * **Biała lista Workera:** Nową domenę należy dopisać do tablicy `ALLOWED_STATS_HOSTS` w pliku `backend/cloudflare-worker.js`, aby Worker mógł przekazywać dane z ominięciem CORS.

2. **Publiczne API FiveM / CFX.re:**
   * Jeśli serwer podaje kod dołączenia `cfx.re/join/{kod}`, odpytujemy:
     `https://servers-frontend.fivem.net/api/servers/single/{kod}`
   * Zwraca obiekt `Data.clients` oraz `Data.sv_maxclients`.

3. **Gdy serwer nie ma otwartego API / blokuje porty (Fallback):**
   * Jeśli serwer (np. V-Life) ukrywa statystyki lub zabezpiecza port 30120 za firewallem DDoS:
     * Wpisujemy estymowaną bazę graczy: `"basePlayers": 128`.
     * Pole `"statsUrl": null` lub `"cfxEndpoint": null`.
     * **Użytkownik może dosłać aktualny kod CFX lub link do endpointu**, a my natychmiast go podpinamy.

---

## 2. Przygotowanie i Wdrażanie Logotypu / Banera

Aby baner wyglądał profesjonalnie w cyberpunkowym HUD karty:

1. **Źródła grafik serwera:**
   * **Oficjalne zasoby WWW:** Paski nawigacji, Brand Guide, pliki SVG lub transparentne PNG.
   * **Discord Guild API:** Korzystając z oficjalnego zaproszenia `https://discord.com/api/v9/invites/{kod}`, pobieramy oficjalne banery serwerowe Discorda (`guild.banner`, `guild.splash` w rozdzielczości do 1024px).
   * **Materiały nadesłane przez graczy:** Format 1024x215 lub proporcje poziome (jak logotyp Strefy RP).

2. **Lokalizacja pliku:**
   * Plik zapisujemy zawsze w katalogu:
     `img/servers/[nazwa-serwera].png` (lub `.svg`).

3. **Zachowanie w stylach CSS (`css/style.css`):**
   * Kontener `.hud-card-cover` ma wysokość `180px`.
   * Odstęp `padding-top: 2.2rem` chroni plakietki `ROLEPLAY`, `FIVEM`, `WL ON` przed zasłonięciem.
   * Logo posiada `max-height: 122px`, `max-width: 94%`, `border-radius: 6px`, `object-fit: contain` oraz neonowy cień `drop-shadow(0 0 18px rgba(0, 240, 255, 0.45))`.

---

## 3. Format Wpisu w `data/servers.json`

Każdy nowy serwer wprowadzamy wg poniższego schematu:

```json
{
  "id": "unikalny-slug",
  "name": "Pełna Nazwa Serwera",
  "banner": "img/servers/slug.png",
  "platform": "fivem",
  "category": "roleplay",
  "type": "voice",
  "whitelist": true,
  "directConnect": "connect play.serwer.pl",
  "cfxEndpoint": "kod-lub-null",
  "live": {
    "enabled": true,
    "statsUrl": "https://api.../stats-lub-null",
    "basePlayers": 120,
    "maxClients": 250
  },
  "tags": ["FiveM", "Hardcore RP", "WL ON"],
  "description": "Długi opis projektu do modala i SEO.",
  "shortDescription": "Zwięzły 1-zdaniowy opis do kafelka HUD.",
  "discord": "https://discord.gg/link",
  "website": "https://serwer.pl",
  "slots": 250,
  "votes": 0,
  "featured": false,
  "createdAt": "YYYY-MM-DD"
}
```

* **Głosy:** Zawsze startują od `"votes": 0` (gracze głosują bezpośrednio na stronie).
* **Kaskada przycisków:** Skrypt automatycznie priorytetyzuje `STRONA` -> `DISCORD` -> `CONNECT (F8)` z dodatkową ikoną Discorda obok.

---

## 4. Rejestr Dodanych Serwerów i Status Live API

| ID | Serwer | Platforma | Typ | Status Live API | Grafika |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `strefa-rp` | Strefa RP | FiveM | Voice | **LIVE 100%**: Dedykowane API (`api.strefarp.gg`) | `img/servers/strefa-rp.png` |
| `v-life` | V-LIFE | FiveM | Voice | **Fallback**: Realistyczna baza (`basePlayers: 128`) | `img/servers/v-life.png` |
| `v-rp` | Vibe Role Play | Text (RAGE:MP) | Text | **LIVE 100%**: RAGE:MP Masterlist (`cdn.rage.mp/master/`) | `img/servers/v-rp.png` |
| `hyperp` | HypeRP | FiveM | Voice | **LIVE 100%**: FiveM CFX API (`cfx.re/join/xlzymym`) | `img/servers/hyperp.png` |
| `77rp` | 77RP | FiveM | Voice | **LIVE 100%**: FiveM CFX API (`cfx.re/join/965vlm`) | `img/servers/77rp.png` |
| `futurerp` | Future Roleplay | FiveM | Voice | **LIVE 100%**: FiveM CFX API (`cfx.re/join/e66dlba`) | `img/servers/futurerp.png` |
| `oslorp` | OSLORP | FiveM | Voice | **LIVE 100%**: FiveM CFX API (`cfx.re/join/xll9rkm`) | `img/servers/oslorp.png` |
| `myrp` | MyRP.pl | FiveM | Voice | **LIVE 100%**: FiveM CFX API (`cfx.re/join/3yy5q9o`) | `img/servers/myrp.png` |
| `exoticrp` | ExoticRP | FiveM | Voice | **LIVE 100%**: FiveM CFX API (`cfx.re/join/oaaz96x`) | `img/servers/exoticrp.png` |
| `onbeat` | OnBeat | FiveM | Voice | **LIVE 100%**: FiveM CFX API (`cfx.re/join/jjj4kl`) | `img/servers/onbeat.png` |
| `nopixel` | NoPixel Studios | FiveM | Voice | **WL Direct**: Autorska infrastruktura NoPixel V (`basePlayers: 280`) | `img/servers/nopixel.png` |

> [!TIP]
> Większość serwerów w katalogu odpytuje teraz **prawdziwe, oficjalne serwery FiveM / RAGE:MP w czasie rzeczywistym**. W razie problemów z siecią lub restartu zewnętrznego hosta, system płynnie przełącza się na realistyczny fallback z indywidualną wariacją.


