# Raport audytu bezpieczeństwa

Data audytu: 2026-09-12

Audyt objął całe repozytorium, w tym kod aplikacji, konfiguracje, zależności,
skrypty, workflow GitHub Actions, pliki infrastruktury oraz historię i status
Git. Poniżej ujęto wyłącznie problemy o wysokiej pewności wystąpienia.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | `backend/cloudflare-worker.js` | 502-556 | Endpoint `POST /api/votes` przetwarza żądanie przed globalną walidacją `Content-Type` i nie sprawdza `isAllowed`/`Origin`. Akceptuje więc prosty cross-origin POST z `Content-Type: text/plain`, a następnie parsuje jego treść jako JSON. Złośliwa strona może wymusić głos z adresem IP odwiedzającego, omijając zamierzoną ochronę jednego głosu na IP i manipulując rankingiem. | 10/10 |

## Rekomendacja

Przed wejściem do obsługi `/api/votes` egzekwować allowlistę origin dla
wszystkich żądań zmieniających stan. W samym handlerze wymagać
`Content-Type: application/json`; dodatkowo odrzucać żądania bez `Origin` lub
z niezatwierdzonego originu, ewentualnie wprowadzić jawny mechanizm CSRF.

## Zakres i ograniczenia

Raport nie zawiera problemów o niskiej pewności ani hipotetycznych uwag.
Audyt nie wprowadzał zmian w kodzie produkcyjnym. Zalecane jest wykonanie
testu regresji po wdrożeniu poprawki, obejmującego poprawne żądanie z
zatwierdzonej domeny oraz żądanie cross-origin z `Content-Type: text/plain`.
