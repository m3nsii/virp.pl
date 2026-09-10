import { readFile } from 'node:fs/promises';

const servers = JSON.parse(await readFile('data/servers.json', 'utf8'));

console.log('Testing live server endpoints...');

for (const s of servers) {
  const url = s.live?.statsUrl;
  if (!url) {
    console.log(`[ESTIMATED] ${s.name}: ~${s.live?.basePlayers || 'N/A'} (brak zewnętrznego API)`);
    continue;
  }
  
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    clearTimeout(timeout);
    
    if (res.ok) {
      const data = await res.json();
      let count = 'N/A';
      if (data.Data && data.Data.clients !== undefined) count = data.Data.clients;
      else if (data.players_online !== undefined) count = data.players_online;
      else if (s.live?.ragempHost && data[s.live.ragempHost]) count = data[s.live.ragempHost].players;
      else if (data.clients !== undefined) count = data.clients;
      console.log(`[OK ${res.status}] ${s.name}: ${count} graczy online`);
    } else {
      console.log(`[HTTP ${res.status}] ${s.name}: API zwróciło status błędu`);
    }
  } catch (err) {
    console.log(`[ERR] ${s.name}: ${err.message}`);
  }
}
