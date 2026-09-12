import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawnSync } from 'node:child_process';

let errors = 0;
let warnings = 0;

function logPass(msg) {
  console.log(`[PASS] ${msg}`);
}
function logFail(msg) {
  console.error(`[FAIL] ${msg}`);
  errors++;
}
function logWarn(msg) {
  console.warn(`[WARN] ${msg}`);
  warnings++;
}

console.log('=== Rozpoczynanie kompleksowego testu VIRP.pl ===\n');

// 1. Sprawdzanie składni JS
const jsFiles = [
  'js/app.js',
  'js/servers.js',
  'js/streamers.js',
  'js/modal.js',
  'js/toolkit.js',
  'backend/cloudflare-worker.js'
];

for (const f of jsFiles) {
  const res = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (res.status === 0) {
    logPass(`Składnia JS: ${f}`);
  } else {
    logFail(`Błąd składni JS w ${f}: ${res.stderr}`);
  }
}

// 2. Sprawdzanie plików JSON
const jsonFiles = ['data/servers.json', 'data/streamers.json'];
let serversData = [];
let streamersData = [];

for (const f of jsonFiles) {
  try {
    const content = await readFile(f, 'utf8');
    const parsed = JSON.parse(content);
    if (f.includes('servers')) serversData = Array.isArray(parsed) ? parsed : (parsed.servers || []);
    if (f.includes('streamers')) streamersData = Array.isArray(parsed) ? parsed : (parsed.streamers || []);
    const count = f.includes('servers') ? serversData.length : streamersData.length;
    logPass(`Poprawny JSON: ${f} (${count} wpisów)`);
  } catch (err) {
    logFail(`Błąd parsowania JSON ${f}: ${err.message}`);
  }
}

// 3. Weryfikacja istnienia grafik serwerów na dysku
console.log('\n--- Weryfikacja grafik serwerów ---');
for (const server of serversData) {
  const bannerPath = server.banner;
  if (!bannerPath) {
    logWarn(`Serwer ${server.name} (${server.id}) nie ma pola 'banner'`);
    continue;
  }
  try {
    await access(bannerPath, constants.R_OK);
    logPass(`Grafika serwera OK: ${server.name} -> ${bannerPath}`);
  } catch {
    logFail(`BRAKUJĄCA GRAFIKA dla serwera ${server.name} (${server.id}): ${bannerPath}`);
  }
}

// 4. Weryfikacja istnienia grafik streamerów na dysku
console.log('\n--- Weryfikacja grafik streamerów ---');
for (const streamer of streamersData) {
  if (streamer.avatar && !streamer.avatar.startsWith('http')) {
    try {
      await access(streamer.avatar, constants.R_OK);
      logPass(`Avatar twórcy OK: ${streamer.name} -> ${streamer.avatar}`);
    } catch {
      logWarn(`Brak lokalnego pliku avatara dla ${streamer.name}: ${streamer.avatar}`);
    }
  }
}

// 5. Weryfikacja markerów konfliktów w plikach źródłowych
console.log('\n--- Weryfikacja markerów konfliktów Git w projekcie ---');
const allTextFiles = [...jsFiles, ...jsonFiles, 'index.html', 'gta6/index.html', 'gta6/premiera/index.html', 'gta6/mapa/index.html', 'klipy/index.html', 'toolkit/index.html', 'streamerzy/index.html', 'css/style.css'];
for (const f of allTextFiles) {
  try {
    const text = await readFile(f, 'utf8');
    const hasConflict = /^(<{7}|>{7})\s|^={7}$/m.test(text);
    if (hasConflict) {
      logFail(`WYKRYTO ZNACZNIK KONFLIKTU GIT W PLIKU: ${f}`);
    } else {
      logPass(`Brak konfliktów: ${f}`);
    }
  } catch (e) {
    logFail(`Nie można odczytać ${f}: ${e.message}`);
  }
}

// 6. Test integracyjny logiki statystyk serwerów (Live API + Fallback)
console.log('\n--- Test logiki statystyk serwerów (Live + Estimated) ---');
for (const s of serversData) {
  const maxSlots = parseInt(s.slots, 10) || 300;
  const baseP = Number.isInteger(s.live?.basePlayers) ? s.live.basePlayers : null;
  const hasStatsUrl = Boolean(s.live?.statsUrl);

  if (hasStatsUrl) {
    logPass(`Serwer ${s.name}: posiada Live API [${s.live.statsUrl.substring(0, 45)}...]`);
  } else if (baseP !== null) {
    logPass(`Serwer ${s.name}: brak URL API, ale posiada poprawny fallback szacunkowy (${baseP}/${maxSlots} graczy)`);
  } else {
    logFail(`Serwer ${s.name}: brak zarówno statsUrl jak i basePlayers - pokaże 'BRAK DANYCH LIVE'`);
  }
}

// 7. Sprawdzenie CSP w index.html
console.log('\n--- Weryfikacja Content-Security-Policy w index.html ---');
const indexHtml = await readFile('index.html', 'utf8');
const cspMatch = indexHtml.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i);
if (cspMatch) {
  const csp = cspMatch[1];
  const requiredConnectDomains = [
    'https://virp-proxy.chojmarcel.workers.dev',
    'https://frontend.cfx-services.net',
    'https://api.strefarp.gg',
    'https://cdn.rage.mp'
  ];
  for (const domain of requiredConnectDomains) {
    if (csp.includes(domain)) {
      logPass(`CSP connect-src zawiera: ${domain}`);
    } else {
      logFail(`CSP brakuje domeny connect-src: ${domain}`);
    }
  }
} else {
  logWarn('Nie znaleziono tagu CSP w index.html');
}

console.log(`\n=== Podsumowanie testu: Błędy: ${errors}, Ostrzeżenia: ${warnings} ===`);
if (errors > 0) {
  process.exit(1);
}
