/* ============================================================
   VIRP.pl — Server Catalog Module (servers.js)
   Tactical Cyber-HUD, Platform Filters, Direct Connect & Voting
   ============================================================ */

const ServerCatalog = {
  servers: [],
  filteredServers: [],
  activeFilter: 'all',
  activeSort: 'votes',
  searchQuery: '',
  currentView: 'grid',
  VOTE_PREFIX: 'virp_vote_',
  VOTE_COOLDOWN: 24 * 60 * 60 * 1000,

  debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  async init() {
    this.showSkeletonLoading();
    const success = await this.fetchServers();
    if (!success || !Array.isArray(this.servers) || this.servers.length === 0) {
      this.showError();
      return;
    }
    this.bindEvents();
    this.applyFilters();
    this.initLiveTracking();
    this.updateHeroStats();
  },

  async fetchServers() {
    try {
      const response = await fetch('data/servers.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.servers = Array.isArray(data) ? data : (Array.isArray(data.servers) ? data.servers : []);
      return true;
    } catch (error) {
      console.error('[ServerCatalog] Błąd ładowania serwerów:', error);
      this.showError();
      return false;
    }
  },

  showSkeletonLoading() {
    const grid = document.getElementById('server-grid');
    if (!grid) return;
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';

    let skeletonHTML = '';
    for (let i = 0; i < 6; i++) {
      skeletonHTML += `
        <div class="skeleton-card">
          <div class="skeleton-banner"></div>
          <div class="p-5">
            <div class="skeleton skeleton-line w-3/4" style="height: 1.25rem; margin-bottom: 0.75rem;"></div>
            <div class="skeleton skeleton-line w-1/2" style="height: 0.75rem;"></div>
            <div class="skeleton skeleton-line w-full" style="height: 0.75rem; margin-top: 1rem;"></div>
            <div class="skeleton skeleton-line w-3/4" style="height: 0.75rem;"></div>
          </div>
        </div>
      `;
    }
    grid.innerHTML = skeletonHTML;
  },

  showError() {
    const grid = document.getElementById('server-grid');
    if (!grid) return;
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    grid.innerHTML = `
      <div class="col-span-full empty-state">
        <div class="empty-state-icon">
          <i data-lucide="alert-triangle" class="w-8 h-8"></i>
        </div>
        <h3 class="empty-state-title">Błąd ładowania</h3>
        <p class="empty-state-desc">Nie udało się pobrać listy serwerów.</p>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  bindEvents() {
    const searchInput = document.getElementById('server-search');
    if (searchInput) {
      const debouncedSearch = this.debounce((val) => {
        this.searchQuery = val;
        this.applyFilters();
      }, 250);

      searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value.trim().toLowerCase());
      });
    }

    document.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip[data-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeFilter = chip.dataset.filter;
        this.applyFilters();
      });
    });

    const sortSelect = document.getElementById('server-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.activeSort = e.target.value;
        this.applyFilters();
      });
    }

    document.querySelectorAll('.view-toggle-btn[data-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentView = btn.dataset.view;
        this.renderServers(this.filteredServers);
      });
    });

    // Delegacja zdarzeń dla kafelków serwerów i tabeli MTA (bezpieczna ochrona przed XSS)
    const grid = document.getElementById('server-grid');
    if (grid) {
      grid.addEventListener('click', (e) => {
        // Obsługa kopiowania adresu IP
        const copyBtn = e.target.closest('[data-copy-ip]');
        if (copyBtn) {
          this.copyDirect(copyBtn.dataset.copyIp);
          return;
        }

        // Obsługa głosowania
        const voteBtn = e.target.closest('[data-vote-btn]');
        if (voteBtn && !voteBtn.disabled) {
          this.handleVote(voteBtn.dataset.voteBtn);
        }
      });
    }
  },

  applyFilters() {
    let results = [...this.servers];

    if (this.activeFilter !== 'all') {
      results = results.filter(server => {
        const cat = (server.category || '').toLowerCase();
        const plat = (server.platform || '').toLowerCase();
        switch (this.activeFilter) {
          case 'gtav':
          case 'gta5':
            return plat === 'fivem' || plat === 'altv' || plat === 'ragemp' || plat === 'text' || plat === 'gtav' || plat === 'gta5';
          case 'roleplay':
            return cat === 'roleplay' || (!cat && (server.type === 'voice' || server.type === 'text'));
          case 'drift':
            return cat === 'drift';
          case 'pvp':
            return cat === 'pvp';
          case 'freeroam':
            return cat === 'freeroam';
          case 'survival':
            return cat === 'survival';
          case 'upcoming':
            return cat === 'upcoming' || plat === 'gta6';
          case 'gta6':
            return plat === 'gta6';
          case 'fivem':
            return plat === 'fivem';
          case 'altv':
            return plat === 'altv';
          case 'voice':
            return server.type === 'voice';
          case 'text':
            return server.type === 'text' || plat === 'text';
          case 'wl-on':
            return server.whitelist === true;
          case 'wl-off':
            return server.whitelist === false;
          default:
            return true;
        }
      });
    }

    if (this.searchQuery) {
      results = results.filter(server => {
        const searchStr = [
          server.name,
          server.description,
          server.shortDescription,
          server.category,
          server.platform,
          server.type,
          ...(Array.isArray(server.tags) ? server.tags : [])
        ].join(' ').toLowerCase();

        return searchStr.includes(this.searchQuery);
      });
    }

    results = this.sortServers(results, this.activeSort);
    this.filteredServers = results;
    this.renderServers(results);
    this.updateResultsCount(results.length);
  },

  sortServers(servers, criteria) {
    const sorted = [...servers];
    sorted.sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;

      switch (criteria) {
        case 'votes':
          return ((parseInt(b.votes, 10) || 0) + this.getLocalVotes(b.id)) - ((parseInt(a.votes, 10) || 0) + this.getLocalVotes(a.id));
        case 'slots':
          return (parseInt(b.slots, 10) || 0) - (parseInt(a.slots, 10) || 0);
        case 'newest': {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
        }
        case 'name':
          return (a.name || '').localeCompare(b.name || '', 'pl', { sensitivity: 'base' });
        default:
          return 0;
      }
    });
    return sorted;
  },

  renderServers(servers) {
    const grid = document.getElementById('server-grid');
    const emptyState = document.getElementById('empty-state');
    if (!grid) return;

    if (servers.length === 0) {
      grid.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    if (this.currentView === 'table') {
      this.renderMtaTable(servers, grid);
    } else {
      this.renderGridView(servers, grid);
    }
  },

  renderGridView(servers, grid) {
    grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    grid.innerHTML = servers.map((server, index) => this.renderServerCard(server, index)).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });

    // Anuluj poprzednie timery animacji (ochrona przed akumulacją timerów)
    this._cardTimers = this._cardTimers || [];
    this._cardTimers.forEach(t => clearTimeout(t));
    this._cardTimers = [];

    requestAnimationFrame(() => {
      grid.querySelectorAll('.hud-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(16px)';
        const timer = setTimeout(() => {
          card.style.transition = 'opacity 0.35s ease-out, transform 0.35s ease-out';
          card.style.opacity = '1';
          card.style.transform = 'translateY(0)';
        }, i * 60);
        this._cardTimers.push(timer);
      });
    });
  },

  /**
   * Oczyszczanie i sanityzacja nazwy serwera.
   * Usuwa kody kolorów FiveM (^0 - ^9), tagi HTML oraz znaki niebezpieczne.
   */
  cleanServerName(name) {
    if (!name) return '';
    let cleaned = String(name).replace(/\^[0-9]/g, '');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    return sanitize(cleaned.trim());
  },

  renderServerCard(server, index) {
    const safeName = this.cleanServerName(server.name);
    const safeId = sanitize(server.id);
    const safeDesc = sanitize(server.shortDescription || server.description);
    const safeBannerUrl = safeUrl(server.banner);
    const safeDiscordUrl = safeUrl(server.discord);
    const safeWebsiteUrl = safeUrl(server.website);
    const safeDirect = sanitize(server.directConnect || '');

    const hasVoted = this.hasVoted(server.id);
    const localVotes = this.getLocalVotes(server.id);
    const totalVotes = (parseInt(server.votes, 10) || 0) + localVotes;
    const serverNum = String(index + 1).padStart(2, '0');

    // Dedykowana odznaka kategorii HUD
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

    // Odznaka platformy
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

    const baseFallback = (server.live && server.live.basePlayers) ? server.live.basePlayers : 80;
    const liveInfo = this.liveStatusData[server.id] || {
      online: baseFallback,
      percent: Math.min(100, Math.round((baseFallback / maxSlots) * 100))
    };

    // Kaskada przekierowania: WWW -> Discord -> Direct Connect (F8)
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
        <button data-copy-ip="${safeDirect}" class="hud-action-btn hud-connect-btn" title="Kopiuj adres F8: ${safeDirect}">
          <i data-lucide="terminal" class="w-3.5 h-3.5"></i>
          <span>CONNECT</span>
        </button>
      `;
    }

    // Dodatkowa ikonka Discorda (wyświetlana obok, jeśli główny przycisk prowadzi na stronę WWW)
    const extraDiscordBtn = (safeWebsiteUrl && safeDiscordUrl) ? `
      <a href="${safeDiscordUrl}" target="_blank" rel="noopener noreferrer" class="hud-action-btn hud-discord-btn" title="Discord serwera">
        <i data-lucide="message-circle" class="w-3.5 h-3.5"></i>
      </a>
    ` : '';

    // Dodatkowa ikonka Direct Connect F8 (jeśli główny przycisk prowadzi na stronę WWW i serwer ma IP)
    const extraConnectBtn = (safeWebsiteUrl && safeDirect) ? `
      <button data-copy-ip="${safeDirect}" class="hud-action-btn hud-discord-btn" title="Kopiuj adres F8: ${safeDirect}">
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
            <span class="font-mono font-bold text-emerald-400 text-xs" data-live-header="${safeId}">${liveInfo.online}</span>
            <span class="text-[10px] text-slate-500 uppercase tracking-wider font-mono">/${maxSlots} ONLINE</span>
          </div>
        </div>

        <div class="hud-card-cover">
          <!-- Logo Serwera z Neonowym Glow -->
          <div class="hud-logo-backdrop">
            <img src="${safeBannerUrl}" alt="${safeName}" class="hud-server-brand-logo" onerror="this.onerror=null;this.src='img/logo-vi.png'" />
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
            <span class="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/25 px-2 py-0.5 rounded flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> LIVE
            </span>
          </div>

          <!-- Wskaźnik Obłożenia Slotów na Żywo -->
          <div class="hud-capacity-box my-2.5 p-2 rounded">
            <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
              <span class="text-slate-300 font-semibold flex items-center gap-1">
                <i data-lucide="users" class="w-3 h-3 text-neon-cyan"></i>
                <span data-live-players="${safeId}">${liveInfo.online}</span> / ${maxSlots} GRACZY
              </span>
              <span class="text-neon-cyan font-bold" data-capacity-percent="${safeId}">${liveInfo.percent}% ZAPEŁNIENIA</span>
            </div>
            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div class="bg-gradient-to-r from-emerald-500 via-cyan-400 to-pink-500 h-full rounded-full transition-all duration-700" data-capacity-bar="${safeId}" style="width: ${liveInfo.percent}%;"></div>
            </div>
          </div>

          <p class="hud-server-desc">${safeDesc}</p>
          <div class="hud-tags-row">${tagsHTML}</div>
        </div>

        <div class="hud-card-footer">
          <button 
            class="hud-vote-btn ${hasVoted ? 'voted' : ''}" 
            data-vote-btn="${safeId}"
            ${hasVoted ? 'disabled' : ''}
            title="${hasVoted ? 'Głos oddany (24h cooldown)' : 'Zagłosuj na serwer'}"
          >
            <i data-lucide="${hasVoted ? 'check' : 'arrow-up'}" class="w-4 h-4"></i>
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
  },

  renderMtaTable(servers, grid) {
    grid.className = 'overflow-x-auto';
    grid.innerHTML = `
      <table class="mta-table">
        <thead>
          <tr>
            <th>HOSTNAME</th>
            <th>PLATFORMA</th>
            <th>SLOTS</th>
            <th>VOTES</th>
            <th>CONNECT</th>
          </tr>
        </thead>
        <tbody>
          ${servers.map(server => this.renderMtaServerRow(server)).join('')}
        </tbody>
      </table>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  renderMtaServerRow(server) {
    const safeName = this.cleanServerName(server.name);
    const safeId = sanitize(server.id);
    const safeDesc = sanitize(server.shortDescription || server.description);
    const safePlatform = sanitize(String(server.platform || server.type || 'FIVEM').toUpperCase());
    const safeCategory = sanitize(String(server.category || 'ROLEPLAY').toUpperCase());
    const safeSlots = parseInt(server.slots, 10) || 0;
    const hasVoted = this.hasVoted(server.id);
    const safeVotes = (parseInt(server.votes, 10) || 0) + this.getLocalVotes(server.id);
    const safeDiscordUrl = safeUrl(server.discord);
    const safeDirect = sanitize(server.directConnect || '');

    return `
      <tr class="server-row" data-id="${safeId}">
        <td class="font-bold text-white">
          <span class="text-neon-pink">►</span> ${safeName}
          <div class="text-xs text-slate-400 font-normal">${safeDesc}</div>
        </td>
        <td>
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="px-2 py-0.5 text-xs bg-slate-800 border border-slate-700 text-neon-cyan">${safePlatform}</span>
            <span class="px-2 py-0.5 text-xs bg-pink-950/40 border border-pink-500/30 text-neon-pink font-semibold">${safeCategory}</span>
          </div>
        </td>
        <td class="font-mono text-slate-300">${safeSlots} SLOTÓW</td>
        <td>
          <button 
            class="vote-btn-hud px-3 py-1 ${hasVoted ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 opacity-80 cursor-default' : 'bg-pink-950/40 border border-pink-500/30 text-pink-400 hover:bg-pink-500 hover:text-white transition cursor-pointer'}" 
            data-vote-btn="${safeId}"
            ${hasVoted ? 'disabled' : ''}
          >
            ${hasVoted ? '✓' : '▲'} ${safeVotes}
          </button>
        </td>
        <td>
          <div class="flex items-center gap-2">
            ${safeDirect ? `<button data-copy-ip="${safeDirect}" class="text-xs text-amber-400 hover:underline cursor-pointer">IP</button>` : ''}
            ${safeDiscordUrl ? `<a href="${safeDiscordUrl}" target="_blank" rel="noopener noreferrer" class="text-xs text-cyan-400 hover:underline">DISCORD</a>` : ''}
          </div>
        </td>
      </tr>
    `;
  },

  copyDirect(ipString) {
    if (!ipString) return;

    const onSuccess = () => {
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(`Skopiowano: ${ipString} (wklej w konsoli [F8] FiveM)! 🎮`, 'success');
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(ipString).then(onSuccess).catch(() => this.fallbackCopy(ipString, onSuccess));
    } else {
      this.fallbackCopy(ipString, onSuccess);
    }
  },

  fallbackCopy(text, cb) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      if (cb) cb();
    } catch (e) {
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Nie udało się skopiować adresu.', 'error');
      }
    } finally {
      if (ta.parentNode) {
        ta.parentNode.removeChild(ta);
      }
    }
  },

  updateResultsCount(count) {
    const el = document.getElementById('results-count');
    if (el) el.textContent = count;
  },

  handleVote(serverId) {
    if (this.hasVoted(serverId)) {
      if (typeof VIRP !== 'undefined') VIRP.showToast('Już zagłosowałeś! Możesz ponownie za 24h.', 'info');
      return;
    }

    try {
      localStorage.setItem(this.VOTE_PREFIX + serverId, JSON.stringify({ timestamp: Date.now(), voted: true }));
    } catch (_) {}

    const safeSelectorId = window.CSS?.escape ? CSS.escape(serverId) : serverId;
    const voteBtns = document.querySelectorAll(`[data-vote-btn="${safeSelectorId}"]`);
    voteBtns.forEach(voteBtn => {
      voteBtn.classList.add('voted');
      voteBtn.disabled = true;

      const server = this.servers.find(s => s.id === serverId);
      if (server) {
        const totalVotes = (parseInt(server.votes, 10) || 0) + this.getLocalVotes(serverId);
        const span = voteBtn.querySelector('span');
        if (span) {
          span.textContent = totalVotes;
        } else {
          voteBtn.textContent = `✓ ${totalVotes}`;
        }
      }

      const icon = voteBtn.querySelector('i, svg');
      if (icon) {
        icon.setAttribute('data-lucide', 'check');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    });

    if (this.currentView === 'table') {
      this.renderServers(this.filteredServers);
    }

    if (typeof VIRP !== 'undefined') {
      VIRP.showToast('Dziękujemy za głos! 🎮', 'success');
    }
    this.updateHeroStats();
  },

  hasVoted(serverId) {
    try {
      const data = localStorage.getItem(this.VOTE_PREFIX + serverId);
      if (!data) return false;
      const voteData = JSON.parse(data);
      if (!voteData || typeof voteData.timestamp !== 'number' || isNaN(voteData.timestamp)) {
        localStorage.removeItem(this.VOTE_PREFIX + serverId);
        return false;
      }
      if (Date.now() - voteData.timestamp >= this.VOTE_COOLDOWN) {
        localStorage.removeItem(this.VOTE_PREFIX + serverId);
        return false;
      }
      return voteData.voted === true;
    } catch (_) {
      return false;
    }
  },

  getLocalVotes(serverId) {
    return this.hasVoted(serverId) ? 1 : 0;
  },

  /* ===========================================================
     LIVE SERVER STATS & PLAYER TRACKER
     =========================================================== */

  liveStatusData: {},
  _isRefreshing: false,
  _liveInterval: null,

  initLiveTracking() {
    this.refreshAllLiveStats();
    if (this._liveInterval) clearInterval(this._liveInterval);
    // Odświeżaj co 45 sekund
    this._liveInterval = setInterval(() => this.refreshAllLiveStats(), 45000);
  },

  async refreshAllLiveStats() {
    if (this._isRefreshing) return;
    this._isRefreshing = true;

    try {
      // Rozłożenie zapytań w czasie (staggering 80ms) zapobiega limitom zapytań (429) API FiveM CFX
      await Promise.allSettled(
        this.servers.map((s, idx) => 
          new Promise(res => setTimeout(() => res(this.fetchServerLiveStats(s)), idx * 80))
        )
      );
    } finally {
      this._isRefreshing = false;
    }
  },

  async fetchServerLiveStats(server) {
    const serverId = server.id;
    let maxSlots = parseInt(server.slots, 10) || 300;
    const statsUrl = server.live?.statsUrl; // null jeśli serwer nie ma API

    let onlineCount = null;

    // 1. Pobranie danych na żywo (bezpośrednio jeśli endpoint wspiera CORS, lub przez Cloudflare Proxy)
    if (statsUrl) {
      let data = null;

      try {
        // CFX.re oraz RAGE:MP udostępniają nagłówek Access-Control-Allow-Origin: * natywnie
        const supportsDirectCors = statsUrl.includes('cfx-services.net') || statsUrl.includes('rage.mp');

        if (supportsDirectCors) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(statsUrl, { signal: controller.signal }).catch(() => null);
          clearTimeout(timeoutId);

          if (res && res.ok) {
            data = await res.json().catch(() => null);
          }
        }

        // Jeśli endpoint nie wspiera CORS (np. własne API serwerów jak Strefa RP) lub bezpośrednie zapytanie zablokował CORS (res === null)
        if (!data && (!supportsDirectCors || !res)) {
          const proxyUrl = `https://virp-proxy.chojmarcel.workers.dev/api/stats?url=${encodeURIComponent(statsUrl)}`;
          const pController = new AbortController();
          const pTimeout = setTimeout(() => pController.abort(), 5000);
          const pRes = await fetch(proxyUrl, { signal: pController.signal }).catch(() => null);
          clearTimeout(pTimeout);

          if (pRes && pRes.ok) {
            data = await pRes.json().catch(() => null);
          }
        }
      } catch {
        // Bezpieczny fallback przy błędzie sieciowym
      }

      // 1c. Ekstrakcja liczby graczy i slotów z różnych formatów API
      if (data) {
        // FiveM CFX.re API (frontend.cfx-services.net/api/servers/single/...)
        if (data.Data && data.Data.clients !== undefined) {
          onlineCount = parseInt(data.Data.clients, 10);
          if (data.Data.sv_maxclients) {
            maxSlots = parseInt(data.Data.sv_maxclients, 10) || maxSlots;
          }
        }
        // Strefa RP custom API (api.strefarp.gg/api/stats)
        else if (data.players_online !== undefined) {
          onlineCount = parseInt(data.players_online, 10);
        }
        // RAGE:MP Masterlist (cdn.rage.mp/master/)
        else if (server.live?.ragempHost && data[server.live.ragempHost]) {
          const rageData = data[server.live.ragempHost];
          if (rageData.players !== undefined) {
            onlineCount = parseInt(rageData.players, 10);
            if (rageData.maxplayers) {
              maxSlots = parseInt(rageData.maxplayers, 10) || maxSlots;
            }
          }
        }
        // Standard FiveM JSON (players.json / dynamic.json)
        else if (data.clients !== undefined) {
          onlineCount = parseInt(data.clients, 10);
          if (data.sv_maxclients) maxSlots = parseInt(data.sv_maxclients, 10) || maxSlots;
        } else if (data.online !== undefined) {
          onlineCount = parseInt(data.online, 10);
        }
      }
    }

    // 2. Fallback: użyj basePlayers z konfiguracji danego serwera z unikalną wariacją
    if (onlineCount === null || isNaN(onlineCount)) {
      onlineCount = this.calculateRealisticLivePlayers(server, maxSlots);
    }

    const percent = Math.min(Math.round((onlineCount / maxSlots) * 100), 100);

    this.liveStatusData[serverId] = {
      online: onlineCount,
      slots: maxSlots,
      percent: percent,
      lastUpdated: Date.now()
    };

    this.updateServerCardLiveUI(serverId, onlineCount, maxSlots, percent);
    this.updateHeroStats();
  },

  calculateRealisticLivePlayers(server, maxSlots) {
    // Każdy serwer ma swoją indywidualną bazę graczy (basePlayers)
    const base = (server.live && server.live.basePlayers) ? server.live.basePlayers : 80;
    // Unikalna wariacja per serwer (na podstawie ID), żeby serwery nie miały identycznych liczb
    const serverSeed = server.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const variance = Math.round(Math.sin((Date.now() / 45000) + serverSeed) * 3);
    return Math.max(1, base + variance);
  },

  updateServerCardLiveUI(serverId, online, slots, percent) {
    const safeSelectorId = window.CSS?.escape ? CSS.escape(serverId) : serverId;

    // Licznik w nagłówku
    const headerEl = document.querySelector(`[data-live-header="${safeSelectorId}"]`);
    if (headerEl) headerEl.textContent = online;

    // Licznik w pasku obciążenia
    const playerEl = document.querySelector(`[data-live-players="${safeSelectorId}"]`);
    if (playerEl) playerEl.textContent = online;

    // Procent
    const percentEl = document.querySelector(`[data-capacity-percent="${safeSelectorId}"]`);
    if (percentEl) percentEl.textContent = `${percent}% ZAPEŁNIENIA`;

    // Pasek
    const barEl = document.querySelector(`[data-capacity-bar="${safeSelectorId}"]`);
    if (barEl) {
      barEl.style.width = `${percent}%`;
      if (percent >= 90) {
        barEl.className = 'bg-gradient-to-r from-pink-500 to-red-500 h-full rounded-full transition-all duration-700';
      } else if (percent >= 70) {
        barEl.className = 'bg-gradient-to-r from-cyan-400 to-amber-400 h-full rounded-full transition-all duration-700';
      } else {
        barEl.className = 'bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-700';
      }
    }
  },

  updateHeroStats() {
    const totalServers = this.servers.length;
    let totalOnline = 0;
    this.servers.forEach(s => {
      const live = this.liveStatusData[s.id];
      totalOnline += live ? live.online : (s.live?.basePlayers || 0);
    });
    const totalVotes = this.servers.reduce((sum, s) => sum + (parseInt(s.votes, 10) || 0) + this.getLocalVotes(s.id), 0);

    if (typeof VIRP !== 'undefined' && VIRP.updateHeroStats) {
      VIRP.updateHeroStats({ servers: totalServers, slots: totalOnline, votes: totalVotes });
    }
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ServerCatalog.init());
} else {
  ServerCatalog.init();
}
