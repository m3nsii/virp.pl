import fs from 'fs';
import path from 'path';

function sanitize(str) {
  if (str === null || str === undefined || str === '') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

function safeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim().replace(/['"`<>\\;]/g, '');
  if (trimmed.startsWith('//')) return '';
  try {
    const base = 'https://virp.pl';
    const parsed = new URL(trimmed, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    if (parsed.pathname.toLowerCase().endsWith('.svg') && parsed.origin !== base) return '';
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? parsed.href : trimmed;
  } catch (e) {
    return '';
  }
}

function cleanServerName(name) {
  if (!name) return '';
  let cleaned = String(name).replace(/\^[0-9]/g, '');
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  return sanitize(cleaned.trim());
}

const servers = JSON.parse(fs.readFileSync(path.resolve('data/servers.json'), 'utf-8'));

function renderServerCard(server, index) {
  const safeName = cleanServerName(server.name);
  const safeId = sanitize(server.id);
  const safeDesc = sanitize(server.shortDescription || server.description);
  const safeBannerUrl = safeUrl(server.logo || server.banner);
  const safeDiscordUrl = safeUrl(server.discord);
  const safeWebsiteUrl = safeUrl(server.website);
  const safeDirect = sanitize(server.directConnect || '');

  const totalVotes = Number.isInteger(server.votes) ? server.votes : 0;
  const serverNum = String(index + 1).padStart(2, '0');

  let categoryBadge = '';
  const cat = (server.category || '').toLowerCase();
  if (cat === 'drift') {
    categoryBadge = '<span class="hud-pill hud-pill-amber"><i data-lucide="flame" class="w-3 h-3"></i> DRIFT</span>';
  } else if (cat === 'pvp') {
    categoryBadge = '<span class="hud-pill hud-pill-crimson"><i data-lucide="crosshair" class="w-3 h-3"></i> PVP</span>';
  } else if (cat === 'freeroam') {
    categoryBadge = '<span class="hud-pill hud-pill-cyan"><i data-lucide="gamepad-2" class="w-3 h-3"></i> FREEROAM</span>';
  } else if (cat === 'survival') {
    categoryBadge = '<span class="hud-pill hud-pill-green"><i data-lucide="shield-alert" class="w-3 h-3"></i> SURVIVAL</span>';
  } else if (cat === 'upcoming' || server.platform === 'gta6') {
    categoryBadge = '<span class="hud-pill hud-pill-purple animate-pulse"><i data-lucide="sparkles" class="w-3 h-3"></i> W BUDOWIE // SOON</span>';
  } else {
    categoryBadge = '<span class="hud-pill hud-pill-pink"><i data-lucide="users" class="w-3 h-3"></i> ROLEPLAY</span>';
  }

  let platformBadge = '<span class="hud-pill hud-pill-pink"><i data-lucide="cpu" class="w-3 h-3"></i> FIVEM</span>';
  if (server.platform === 'gta6') {
    platformBadge = '<span class="hud-pill hud-pill-purple"><i data-lucide="sparkles" class="w-3 h-3"></i> GTA VI</span>';
  } else if (server.platform === 'altv') {
    platformBadge = '<span class="hud-pill hud-pill-cyan"><i data-lucide="zap" class="w-3 h-3"></i> ALT:V</span>';
  } else if (server.platform === 'text' || server.type === 'text') {
    platformBadge = '<span class="hud-pill hud-pill-cyan"><i data-lucide="type" class="w-3 h-3"></i> TEXT RP</span>';
  } else if (server.platform === 'mta' || server.platform === 'samp') {
    platformBadge = '<span class="hud-pill hud-pill-amber"><i data-lucide="terminal" class="w-3 h-3"></i> MTA</span>';
  }

  const wlBadge = server.whitelist
    ? '<span class="hud-pill hud-pill-green"><i data-lucide="shield-check" class="w-3 h-3"></i> WL ON</span>'
    : '<span class="hud-pill hud-pill-amber"><i data-lucide="shield-off" class="w-3 h-3"></i> WL OFF</span>';

  const tagsArray = Array.isArray(server.tags) ? server.tags : [];
  const tagsHTML = tagsArray.slice(0, 3).map(tag => `<span class="hud-tag">#${sanitize(tag)}</span>`).join('');
  const maxSlots = parseInt(server.slots, 10) || 300;
  const baseP = Number.isInteger(server.live?.basePlayers) ? server.live.basePlayers : null;
  const defaultAvailable = Number.isInteger(baseP);

  const liveOnline = defaultAvailable ? `~${baseP}` : '—';
  const liveSlots = maxSlots;
  const livePercentNum = defaultAvailable && maxSlots > 0 ? Math.min(Math.round((baseP / maxSlots) * 100), 100) : 0;
  const livePercent = defaultAvailable ? `${livePercentNum}% ZAPEŁNIENIA` : 'BRAK DANYCH';
  const liveState = defaultAvailable ? 'AKTYWNY' : 'BRAK DANYCH LIVE';

  let mainActionBtn = '';
  if (safeWebsiteUrl) {
    mainActionBtn = `
        <a href="${safeWebsiteUrl}" target="_blank" rel="noopener noreferrer" class="hud-action-btn hud-connect-btn" title="Odwiedź stronę główną">
          <i data-lucide="globe" class="w-3.5 h-3.5"></i>
          <span>STRONA</span>
        </a>
    `;
  } else if (safeDiscordUrl) {
    mainActionBtn = `
        <a href="${safeDiscordUrl}" target="_blank" rel="noopener noreferrer" class="hud-action-btn hud-connect-btn" title="Dołącz do Discorda">
          <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
          <span>DISCORD</span>
        </a>
    `;
  } else if (safeDirect) {
    mainActionBtn = `
        <button data-copy-ip="${safeDirect}" class="hud-action-btn hud-connect-btn" title="Kopiuj adres F8: ${safeDirect}" aria-label="Kopiuj adres F8 ${safeDirect}">
          <i data-lucide="terminal" class="w-3.5 h-3.5"></i>
          <span>CONNECT</span>
        </button>
    `;
  }

  const extraDiscordBtn = (safeWebsiteUrl && safeDiscordUrl) ? `
      <a href="${safeDiscordUrl}" target="_blank" rel="noopener noreferrer" class="hud-action-btn hud-discord-btn" title="Discord serwera" aria-label="Otwórz Discord serwera">
        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
      </a>
  ` : '';

  const extraConnectBtn = (safeWebsiteUrl && safeDirect) ? `
      <button data-copy-ip="${safeDirect}" class="hud-action-btn hud-discord-btn" title="Kopiuj adres F8: ${safeDirect}" aria-label="Kopiuj adres F8 ${safeDirect}">
        <i data-lucide="terminal" class="w-3.5 h-3.5"></i>
      </button>
  ` : '';

  return `
      <article class="hud-card ${server.featured ? 'is-featured' : ''}" data-server-id="${safeId}">
        <div class="hud-card-header">
          <div class="flex items-center gap-2">
            <span class="hud-index font-mono text-neon-cyan">[${serverNum}]</span>
            ${server.featured ? '<span class="hud-featured-tag">★ WYRÓŻNIONY</span>' : '<span class="hud-sys-status">SYS_VERIFIED</span>'}
          </div>
          <div class="hud-slots">
            <span class="pulse-dot"></span>
            <span class="font-mono font-bold text-emerald-400 text-xs" data-live-header="${safeId}">${liveOnline}</span>
            <span class="text-[10px] text-slate-500 uppercase tracking-wider font-mono">/${liveSlots} ONLINE</span>
          </div>
        </div>

        <div class="hud-card-cover">
          <div class="hud-logo-backdrop">
            <img src="${safeBannerUrl}" alt="${safeName}" width="640" height="220" class="hud-server-brand-logo" loading="${index < 6 ? 'eager' : 'lazy'}" decoding="async" onerror="this.onerror=null;this.src='img/logo-vi.png'" />
          </div>
          <div class="hud-card-overlay">
            <div class="hud-badges-row flex flex-wrap gap-1.5">
              ${categoryBadge}
              ${platformBadge}
              ${wlBadge}
            </div>
          </div>
        </div>

        <div class="hud-card-body">
          <div class="flex items-center justify-between gap-2 mb-1">
            <h3 class="hud-server-title flex items-center gap-1.5">
              ${safeName}
              <i data-lucide="badge-check" class="w-4 h-4 text-neon-cyan" title="Zweryfikowany Serwer"></i>
            </h3>
            <span class="font-mono text-[10px] ${defaultAvailable ? 'text-emerald-400 bg-emerald-950/40 border-emerald-500/25' : 'text-slate-400 bg-slate-900/60 border-slate-700'} border px-2 py-0.5 rounded flex items-center gap-1" data-live-status="${safeId}">
              <span class="w-1.5 h-1.5 rounded-full ${defaultAvailable ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span> ${liveState}
            </span>
          </div>

          <div class="hud-capacity-box my-2.5 p-2 rounded">
            <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span class="text-slate-300 font-semibold flex items-center gap-1">
                <i data-lucide="users" class="w-3 h-3 text-neon-cyan"></i>
                <span data-live-players="${safeId}">${liveOnline}</span> / <span data-live-slots="${safeId}">${liveSlots}</span> GRACZY
              </span>
              <span class="text-neon-cyan font-bold" data-capacity-percent="${safeId}">${livePercent}</span>
            </div>
            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="bg-gradient-to-r from-emerald-500 via-cyan-400 to-pink-500 h-full rounded-full transition-all duration-700" data-capacity-bar="${safeId}" style="width: ${livePercentNum}%;"></div>
            </div>
          </div>

          <p class="hud-server-desc">${safeDesc}</p>
          <div class="hud-tags-row">${tagsHTML}</div>
        </div>

        <div class="hud-card-footer">
          <button 
            class="hud-vote-btn" 
            data-vote-btn="${safeId}"
            title="Zagłosuj na serwer"
            aria-label="Zagłosuj na serwer ${safeName}"
          >
            <i data-lucide="arrow-up" class="w-4 h-4" aria-hidden="true"></i>
            <span class="font-mono font-bold">${totalVotes}</span>
          </button>

          <div class="hud-links-group">
            ${mainActionBtn}
            ${extraDiscordBtn}
            ${extraConnectBtn}
          </div>
        </div>
      </article>
  `;
}

const renderedCards = servers.map((s, idx) => renderServerCard(s, idx)).join('\n');
fs.writeFileSync(path.resolve('scripts/prerendered-cards.html'), renderedCards, 'utf-8');
console.log(`Pre-rendered ${servers.length} server cards successfully!`);
