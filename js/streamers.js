/* ============================================================
   VIRP.pl — Streamers & Clips Hub Portal Module (streamers.js)
   Dedykowany portal twórców z integracją Twitch & Kick API
   oraz systemem Top Klipów Społeczności
   ============================================================ */

const StreamersHub = {
  streamers: [],
  clips: [],
  filteredStreamers: [],
  activeFilter: 'all',
  activeSort: 'viewers',
  searchQuery: '',
  activeClipTime: 'all',
  activeClipSort: 'best',
  userVotedClips: new Set(),
  isOpen: false,
  WORKER_API_URL: 'https://virp-proxy.chojmarcel.workers.dev/api/streamers',
  FEATURED_TWITCH_CLIPS: ['pago3', 'banduracartel', 'mrdzinold'],
  FEATURED_KICK_CLIPS: [
    {
      id: 'kick-neexcsgo-01M1VV2FVDBFEEWT12QZF8SEYA',
      title: 'Przykładowy klip Kick — neexcsgo',
      streamer: 'neexcsgo',
      streamerLogin: 'neexcsgo',
      streamerAvatar: 'img/streamers/neexcsgo.webp',
      platform: 'kick',
      url: 'https://kick.com/neexcsgo/clips/clip_01M1VV2FVDBFEEWT12QZF8SEYA',
      thumbnail: '',
      duration: '—',
      views: 0,
      votes: 0,
      isFeaturedSample: true
    },
    {
      id: 'kick-lequ-01M1F9HYVGFN3WBANQ6RSN2QVE',
      title: 'Przykładowy klip Kick — lequ',
      streamer: 'lequ',
      streamerLogin: 'lequ',
      streamerAvatar: 'img/streamers/lequ.webp',
      platform: 'kick',
      url: 'https://kick.com/lequ/clips/clip_01M1F9HYVGFN3WBANQ6RSN2QVE',
      thumbnail: '',
      duration: '—',
      views: 0,
      votes: 0,
      isFeaturedSample: true
    },
    {
      id: 'kick-niter-01M1HM5ZEZSY8MEWXZ6XGBYW4V',
      title: 'Przykładowy klip Kick — niter',
      streamer: 'niter',
      streamerLogin: 'niter',
      streamerAvatar: 'img/streamers/niter.webp',
      platform: 'kick',
      url: 'https://kick.com/niter/clips/clip_01M1HM5ZEZSY8MEWXZ6XGBYW4V',
      thumbnail: '',
      duration: '—',
      views: 0,
      votes: 0,
      isFeaturedSample: true
    },
    {
      id: 'kick-rybsonlol-01KZW0GWXWCVV21YWFXE6S9TTR',
      title: 'Przykładowy klip Kick — rybsonlol',
      streamer: 'rybsonlol',
      streamerLogin: 'rybsonlol',
      streamerAvatar: 'img/streamers/rybsonlol.webp',
      platform: 'kick',
      url: 'https://kick.com/rybsonlol/clips/clip_01KZW0GWXWCVV21YWFXE6S9TTR',
      thumbnail: '',
      duration: '—',
      views: 0,
      votes: 0,
      isFeaturedSample: true
    },
    {
      id: 'kick-xmerghani-01M1AME5XWDGRVFQWT7JT1S8CP',
      title: 'Przykładowy klip Kick — xmerghani',
      streamer: 'xmerghani',
      streamerLogin: 'xmerghani',
      streamerAvatar: 'img/streamers/xmerghani.webp',
      platform: 'kick',
      url: 'https://kick.com/xmerghani/clips/clip_01M1AME5XWDGRVFQWT7JT1S8CP',
      thumbnail: '',
      duration: '—',
      views: 0,
      votes: 0,
      isFeaturedSample: true
    }
  ],

  async init() {
    this.portal = document.getElementById('streamers-portal');
    this.loadVotedClips();
    await this.fetchData();
    this.bindEvents();
    this.checkHash();
    Top3InfoModal.init();
    StreamerApplicationModal.init();
    ClipApplicationModal.init();
    ClipViewerModal.init();
  },

  loadVotedClips() {
    this.userVotedClips = new Set();
    try {
      const saved = localStorage.getItem('virp_voted_clips');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.userVotedClips = new Set(parsed);
        }
      }
    } catch (_) {}
  },

  saveVotedClips() {
    try {
      localStorage.setItem('virp_voted_clips', JSON.stringify(Array.from(this.userVotedClips)));
    } catch (_) {}
  },

  async fetchData() {
    try {
      const response = await fetch('data/streamers.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      this.streamers = Array.isArray(data.streamers) ? data.streamers : (Array.isArray(data) ? data : []);
      this.clips = this.withFeaturedKickClips(Array.isArray(data.clips) ? data.clips : []);

      // Zsynchronizuj lokalne głosy z klipami
      this.syncLocalClipVotes();

      // Odpytaj Worker asynchronicznie w tle (nie blokuj startu aplikacji)
      this.fetchLiveStatusFromWorker();
    } catch (error) {
      console.error('[StreamersHub] Błąd pobierania bazy twórców:', error);
      this.streamers = [];
      this.clips = [];
    }
  },

  debounce(fn, delay = 250) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  syncLocalClipVotes() {
    try {
      const raw = localStorage.getItem('virp_clip_vote_counts');
      if (!raw) return;
      const localVotes = JSON.parse(raw);
      if (localVotes && typeof localVotes === 'object' && !Array.isArray(localVotes)) {
        this.clips.forEach(clip => {
          if (clip && clip.id && typeof localVotes[clip.id] === 'number') {
            clip.votes = localVotes[clip.id];
          }
        });
      }
    } catch (_) {}
  },

  async fetchLiveStatusFromWorker() {
    if (this._isFetchingLive) return;
    this._isFetchingLive = true;

    const twitchLogins = this.streamers
      .filter(s => s.platform === 'twitch' && s.channelLogin)
      .map(s => s.channelLogin.toLowerCase());

    const kickLogins = this.streamers
      .filter(s => s.platform === 'kick' && s.channelLogin)
      .map(s => s.channelLogin.toLowerCase());

    if (twitchLogins.length === 0 && kickLogins.length === 0) {
      this._isFetchingLive = false;
      return;
    }

    try {
      const allLogins = [...twitchLogins, ...kickLogins];
      const params = new URLSearchParams();
      params.set('logins', allLogins.join(','));
      if (twitchLogins.length > 0) params.set('twitch', twitchLogins.join(','));
      if (kickLogins.length > 0) params.set('kick', kickLogins.join(','));
      params.set('clips', this.FEATURED_TWITCH_CLIPS.join(','));

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

      let res = null;
      try {
        res = await fetch(`${this.WORKER_API_URL}?${params.toString()}`, {
          signal: controller ? controller.signal : undefined
        });
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      if (!res || !res.ok) throw new Error(`Worker HTTP ${res ? res.status : 'ERR'}`);
      const data = await res.json();

      if (data && data.live) {
        this.streamers.forEach(s => {
          const login = (s.channelLogin || '').toLowerCase();
          const liveInfo = data.live[login];

          if (liveInfo && (liveInfo.isLive || liveInfo.viewers > 0)) {
            s.isLive = true;
            s.viewers = liveInfo.viewers || 0;
            s.title = liveInfo.title || '';
            s.currentGame = liveInfo.game || 'Grand Theft Auto V';
            s.thumbnail = liveInfo.thumbnail || null;
          } else {
            s.isLive = false;
            s.viewers = 0;
            s.currentGame = null;
            s.thumbnail = null;
          }
        });

        // Jeśli portal jest otwarty w trakcie nadejścia danych, odśwież widok
        if (this.isOpen) {
          this.updateTelemetry();
          this.renderSpotlight();
          this.applyFilters();
          if (typeof lucide !== 'undefined' && this.portal) lucide.createIcons({ root: this.portal });
        }
      }
      if (data && Array.isArray(data.clips)) {
        const localVotes = new Map(this.clips.map(clip => [clip.id, clip.votes || 0]));
        const remoteClips = data.clips.map(clip => ({
          ...clip,
          votes: localVotes.get(clip.id) || 0
        }));
        this.clips = this.withFeaturedKickClips(remoteClips);
        this.syncLocalClipVotes();
        if (this.isOpen) this.renderClips();
      }
    } catch (err) {
      console.warn('[StreamersHub] Statusy live z Workera chwilowo niedostępne:', err);
    } finally {
      this._isFetchingLive = false;
    }
  },

  startLivePolling() {
    this.stopLivePolling();
    this._liveInterval = setInterval(() => {
      if (document.hidden) return;
      if (this.isOpen) {
        this.fetchLiveStatusFromWorker();
      }
    }, 45000);
  },

  stopLivePolling() {
    if (this._liveInterval) {
      clearInterval(this._liveInterval);
      this._liveInterval = null;
    }
  },

  bindEvents() {
    // Nawigacja — linki otwierające portal streamerów
    document.querySelectorAll('a[href="#streamers"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.openPortal('streamers');
      });
    });

    // Nawigacja — linki otwierające portal bezpośrednio w sekcji klipów
    document.querySelectorAll('a[href="#clips"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (!this.isOpen) {
          this.openPortal('clips');
        } else {
          this.scrollToClips();
          if (window.location.hash !== '#clips') {
            window.history.pushState(null, '', '#clips');
          }
        }
      });
    });

    // Przycisk powrotu / zamknięcia portalu
    const closeBtn = document.getElementById('streamers-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePortal());
    }

    // Zamknięcie klawiszem Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        // Jeśli nie ma otwartego modala wyżej, zamknij portal
        const anyModalOpen = document.querySelector('.modal-overlay.open');
        if (!anyModalOpen) {
          this.closePortal();
        }
      }
    });

    // Filtry platform
    document.querySelectorAll('[data-streamer-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-streamer-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.dataset.streamerFilter;
        this.applyFilters();
      });
    });

    // Sortowanie streamerów
    const sortSelect = document.getElementById('streamer-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.activeSort = e.target.value;
        this.applyFilters();
      });
    }

    // Wyszukiwarka twórców z debouncem (250ms)
    const searchInput = document.getElementById('streamer-search');
    if (searchInput) {
      const debouncedSearch = this.debounce((val) => {
        this.searchQuery = val;
        this.applyFilters();
      }, 250);

      searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value.trim().toLowerCase());
      });
    }

    const clipSortSelect = document.getElementById('clip-sort-select');
    if (clipSortSelect) {
      clipSortSelect.addEventListener('change', (e) => {
        this.activeClipSort = e.target.value;
        this.renderClips();
      });
    }

    // Filtry czasowe klipów
    document.querySelectorAll('[data-clip-time]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-clip-time]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeClipTime = btn.dataset.clipTime;
        this.renderClips();
      });
    });

    // Przycisk zgłoszenia klipu w banerze informacyjnym
    const bannerClipBtn = document.getElementById('banner-clip-submit-btn');
    if (bannerClipBtn) {
      bannerClipBtn.addEventListener('click', () => ClipApplicationModal.open());
    }

    window.addEventListener('hashchange', () => this.checkHash());
    window.addEventListener('popstate', () => this.checkHash());
  },

  checkHash() {
    if (window.location.hash === '#streamers') {
      if (!this.isOpen) this.openPortal('streamers');
    } else if (window.location.hash === '#clips') {
      if (!this.isOpen) {
        this.openPortal('clips');
      } else {
        this.scrollToClips();
      }
    } else if (this.isOpen) {
      this.closePortal();
    }
  },

  scrollToClips() {
    const clipsSec = document.getElementById('clips-section');
    if (clipsSec) {
      clipsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  async openPortal(target = 'streamers') {
    if (!this.portal) return;
    this.isOpen = true;
    if (window.Gta6Portal && window.Gta6Portal.isOpen) {
      window.Gta6Portal.closePortal();
    }
    this.portal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Natychmiastowy render kafelków z aktualnej bazy
    this.updateTelemetry();
    this.renderSpotlight();
    this.applyFilters();
    this.renderClips();

    const targetHash = target === 'clips' ? '#clips' : '#streamers';
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, '', targetHash);
    }

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: this.portal });

    if (target === 'clips') {
      setTimeout(() => this.scrollToClips(), 150);
    } else {
      this.portal.scrollTop = 0;
    }

    // Włącz cykliczne odświeżanie w tle i zaktualizuj statusy
    this.startLivePolling();
    this.fetchLiveStatusFromWorker();
  },

  closePortal() {
    if (!this.portal) return;
    this.isOpen = false;
    this.stopLivePolling();
    this.portal.classList.add('hidden');
    document.body.style.overflow = '';

    if (window.location.hash === '#streamers' || window.location.hash === '#clips') {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  },

  updateTelemetry() {
    const totalViewers = this.streamers.reduce((acc, s) => acc + (s.isLive ? (parseInt(s.viewers) || 0) : 0), 0);
    const activeLive = this.streamers.filter(s => s.isLive).length;

    const viewersEl = document.getElementById('streamers-total-viewers');
    const activeEl = document.getElementById('streamers-active-count');
    const countLabel = document.getElementById('streamers-count-label');

    if (viewersEl) viewersEl.textContent = totalViewers.toLocaleString('pl-PL');
    if (activeEl) activeEl.textContent = `${activeLive} NA ŻYWO`;
    if (countLabel) countLabel.textContent = `${this.streamers.length} TWÓRCÓW`;
  },

  renderSpotlight() {
    const container = document.getElementById('streamers-spotlight');
    if (!container) return;

    // Pomocnik do rozpoznawania kategorii GTA V / FiveM
    const isGtaCategory = (gameName) => {
      if (!gameName || typeof gameName !== 'string') return false;
      const s = gameName.toLowerCase();
      return s.includes('grand theft auto') || s.includes('gta') || s.includes('fivem');
    };

    // Reguła 1: Wyróżnienie działa TYLKO wtedy, gdy streamer jest LIVE (isLive === true)
    const allLive = this.streamers.filter(s => s && s.isLive === true);

    // Podział na partnerów (aktywna współpraca/barter) i pozostałych twórców
    const livePartners = allLive.filter(s => s.isPartner === true || s.partner === true);
    const liveOthers = allLive.filter(s => !(s.isPartner === true || s.partner === true));

    // Priorytet 1: Partnerzy grający w GTA V / FiveM (losowa rotacja dla równego barteru)
    const partnersGta = livePartners.filter(s => isGtaCategory(s.currentGame)).sort(() => 0.5 - Math.random());
    // Priorytet 2: Partnerzy grający w inne gry (losowa rotacja)
    const partnersOther = livePartners.filter(s => !isGtaCategory(s.currentGame)).sort(() => 0.5 - Math.random());

    // Priorytet 3: Pozostali twórcy grający w GTA V / FiveM (posortowani wg widzów)
    const othersGta = liveOthers.filter(s => isGtaCategory(s.currentGame)).sort((a, b) => (b.viewers || 0) - (a.viewers || 0));
    // Priorytet 4: Pozostali twórcy grający w inne gry (posortowani wg widzów)
    const othersOther = liveOthers.filter(s => !isGtaCategory(s.currentGame)).sort((a, b) => (b.viewers || 0) - (a.viewers || 0));

    // TOP 3: GTA Partnerzy -> Pozostali Partnerzy -> GTA Twórcy -> Pozostali Twórcy
    const top3 = [...partnersGta, ...partnersOther, ...othersGta, ...othersOther].slice(0, 3);

    if (top3.length === 0) {
      container.innerHTML = `
        <div class="top3-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div class="flex items-center gap-2.5 flex-wrap">
            <div class="w-2.5 h-2.5 rounded-full bg-slate-500"></div>
            <h3 class="text-lg sm:text-xl font-display font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <span>TOP 3 TRANSMISJE // LIVE</span>
              <span class="hud-pill hud-pill-amber text-[10px]">CZEKA NA TRANSMISJE</span>
            </h3>
          </div>
          <button type="button" id="open-top3-info-btn" class="top3-how-to-btn text-xs font-mono text-neon-cyan hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 rounded bg-cyan-950/30 border border-cyan-500/30 hover:border-neon-cyan">
            <i data-lucide="help-circle" class="w-3.5 h-3.5 text-neon-cyan"></i>
            <span>Jak zdobyć odznakę POLECANY i stałe TOP 3?</span>
          </button>
        </div>

        <div class="top3-empty-card p-6 sm:p-8 rounded-xl bg-gradient-to-r from-[#0d121f]/90 via-[#101728]/90 to-[#0d121f]/90 border border-white/10 text-center flex flex-col items-center justify-center">
          <div class="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center mb-3 text-neon-pink">
            <i data-lucide="radio" class="w-6 h-6"></i>
          </div>
          <h4 class="font-display text-lg text-white font-bold uppercase tracking-wider mb-1">
            Aktualnie żaden ze streamerów nie prowadzi transmisji
          </h4>
          <p class="text-xs sm:text-sm text-slate-400 font-mono max-w-lg mb-5">
            Wyróżnienie w TOP 3 działa wyłącznie dla aktywnych transmisji na żywo. Gdy streamerzy z naszej bazy odpalą stream, pojawią się tu automatycznie!
          </p>
          <div class="flex items-center gap-3 flex-wrap justify-center">
            <button type="button" id="top3-empty-how-btn" class="btn-secondary text-xs py-2.5 px-4 flex items-center gap-2 cursor-pointer">
              <i data-lucide="help-circle" class="w-4 h-4"></i>
              <span>Zasady Barteru i TOP 3</span>
            </button>
            <button type="button" id="top3-empty-apply-btn" class="btn-primary text-xs py-2.5 px-4 flex items-center gap-2 cursor-pointer">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              <span>Zgłoś Swój Kanał</span>
            </button>
          </div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
      return;
    }

    container.innerHTML = `
      <div class="top3-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="w-2.5 h-2.5 rounded-full bg-neon-pink animate-ping"></div>
          <h3 class="text-lg sm:text-xl font-display font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <span>TOP 3 TRANSMISJE // LIVE</span>
          </h3>
        </div>
        <button type="button" id="open-top3-info-btn" class="top3-how-to-btn text-xs font-mono text-neon-cyan hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 rounded bg-cyan-950/30 border border-cyan-500/30 hover:border-neon-cyan">
          <i data-lucide="help-circle" class="w-3.5 h-3.5 text-neon-cyan"></i>
          <span>Jak zdobyć odznakę POLECANY i stałe TOP 3?</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${top3.map((streamer, idx) => this.renderTop3Card(streamer, idx)).join('')}
      </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: container });
  },

  renderTop3Card(s, idx) {
    const isPartner = s.isPartner === true || s.partner === true;
    const safeName = typeof sanitize === 'function' ? sanitize(s.name) : s.name;
    const safeTitle = typeof sanitize === 'function' ? sanitize(s.title || 'Transmisja na żywo') : (s.title || 'Transmisja na żywo');
    const safeGame = typeof sanitize === 'function' ? sanitize(s.currentGame || 'Grand Theft Auto V') : (s.currentGame || 'Grand Theft Auto V');
    const safePlatform = (s.platform || 'twitch').toUpperCase();
    const safeViewers = s.viewers ? parseInt(s.viewers).toLocaleString('pl-PL') : '0';
    const safeChannelUrl = typeof window.safeUrl === 'function' ? window.safeUrl(s.channelUrl) : s.channelUrl;
    const safeAvatar = typeof window.safeUrl === 'function' ? window.safeUrl(s.avatar) : s.avatar;
    const safeThumbnail = s.thumbnail && typeof window.safeUrl === 'function' ? window.safeUrl(s.thumbnail) : s.thumbnail;

    const rankClasses = ['top3-rank-1', 'top3-rank-2', 'top3-rank-3'];
    const rankClass = rankClasses[idx] || 'top3-rank-3';
    const rankText = `#${idx + 1} LIVE`;

    const partnerBadge = isPartner
      ? `<span class="hud-pill hud-pill-pink text-[10px] flex items-center gap-1 font-bold shadow-sm whitespace-nowrap">
           <span class="pulse-dot"></span> ⭐ POLECANY STREAM
         </span>`
      : `<span class="hud-pill hud-pill-cyan text-[10px] flex items-center gap-1 font-bold shadow-sm whitespace-nowrap">
           <span class="pulse-dot"></span> 🔴 LIVE
         </span>`;

    const platformBadgeClass = safePlatform === 'KICK' ? 'hud-pill-green' : 'hud-pill-pink';

    return `
      <article class="top3-streamer-card ${isPartner ? 'is-partner' : ''}" data-streamer-id="${s.id || ''}">
        <!-- Górna belka: Ranga + Status Partnera + Platforma -->
        <div class="top3-card-header flex items-center justify-between gap-2 p-3.5 border-b border-white/10 bg-black/40">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="top3-rank-badge ${rankClass}">
              ${rankText}
            </span>
            ${partnerBadge}
          </div>
          <span class="hud-pill ${platformBadgeClass} text-[10px] font-mono font-bold">${safePlatform}</span>
        </div>

        <!-- Podgląd Streamu z licznikiem widzów -->
        <div class="top3-preview-box relative w-full aspect-video bg-[#06080f] overflow-hidden border-b border-white/10">
          ${safeThumbnail ? `
            <img src="${safeThumbnail}" alt="${safeName} live stream" class="top3-preview-img w-full h-full object-cover transition-transform duration-500 hover:scale-105" loading="lazy">
          ` : `
            <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-pink-950/30 to-cyan-950/30 text-slate-400">
              <i data-lucide="tv" class="w-10 h-10 text-pink-500/50 mb-1"></i>
              <span class="text-xs font-mono">PODGLĄD TRANSMISJI</span>
            </div>
          `}
          <div class="absolute inset-0 bg-gradient-to-t from-[#0d111d] via-transparent to-transparent opacity-60 pointer-events-none"></div>
          <div class="top3-viewers-tag">
            <span class="streamer-live-viewers-badge font-mono font-bold">🔴 ${safeViewers} WIDZÓW</span>
          </div>
        </div>

        <!-- Profil i Informacje -->
        <div class="p-4 flex-1 flex flex-col justify-between gap-3">
          <div class="flex items-start gap-3">
            <img src="${safeAvatar}" alt="${safeName}" class="top3-avatar w-12 h-12 rounded-lg border-2 ${isPartner ? 'border-neon-pink shadow-pink-500/30' : 'border-slate-700 shadow-cyan-500/10'} shadow-lg object-cover flex-shrink-0" loading="lazy" onerror="this.onerror=null;this.src='img/logo-vi.png'">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <h4 class="font-display text-lg text-white font-bold truncate">${safeName}</h4>
                ${isPartner ? '<i data-lucide="check-circle" class="w-4 h-4 text-neon-pink flex-shrink-0" title="Zweryfikowany Partner VIRP"></i>' : ''}
              </div>
              <p class="text-[11px] text-neon-cyan font-mono truncate">🎮 ${safeGame}</p>
            </div>
          </div>

          <!-- Tytuł transmisji -->
          <p class="text-xs text-slate-300 font-mono line-clamp-2 leading-relaxed" title="${safeTitle}">
            ${safeTitle}
          </p>

          <!-- Przycisk akcji -->
          <div class="pt-1">
            <a href="${safeChannelUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary w-full py-2.5 px-4 text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-pink-500/20">
              <i data-lucide="play" class="w-3.5 h-3.5 fill-current"></i>
              <span>OGLĄDAJ TRANSMISJĘ</span>
            </a>
          </div>
        </div>
      </article>
    `;
  },

  applyFilters() {
    let results = [...this.streamers];

    // Filtr platformy lub tylko na żywo
    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'live') {
        results = results.filter(s => s.isLive === true);
      } else {
        results = results.filter(s => s.platform === this.activeFilter);
      }
    }

    // Filtr wyszukiwarki tekstowej (brak fałszywych dopasowań do słowa "null")
    if (this.searchQuery) {
      results = results.filter(s => {
        const str = [s.name || '', s.channelLogin || '', s.platform || '', s.title || '', s.currentGame || ''].join(' ').toLowerCase();
        return str.includes(this.searchQuery);
      });
    }

    // Wybór trybu sortowania
    switch (this.activeSort) {
      case 'live':
        // Tylko / Najpierw LIVE, potem wg widzów
        results.sort((a, b) => {
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;
          return (b.viewers || 0) - (a.viewers || 0);
        });
        break;

      case 'name':
        // Alfabetycznie A-Z
        results.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl', { sensitivity: 'base' }));
        break;

      case 'kick':
        // Najpierw Kick, potem Twitch
        results.sort((a, b) => {
          if (a.platform === 'kick' && b.platform !== 'kick') return -1;
          if (a.platform !== 'kick' && b.platform === 'kick') return 1;
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;
          return (b.viewers || 0) - (a.viewers || 0);
        });
        break;

      case 'twitch':
        // Najpierw Twitch, potem Kick
        results.sort((a, b) => {
          if (a.platform === 'twitch' && b.platform !== 'twitch') return -1;
          if (a.platform !== 'twitch' && b.platform === 'twitch') return 1;
          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;
          return (b.viewers || 0) - (a.viewers || 0);
        });
        break;

      case 'viewers':
      default:
        // Domyślnie: GTA V LIVE -> Pozostałe LIVE -> Widzowie -> Offline
        results.sort((a, b) => {
          const aGta = a.isLive && (a.currentGame || '').toLowerCase().includes('grand theft auto');
          const bGta = b.isLive && (b.currentGame || '').toLowerCase().includes('grand theft auto');

          if (aGta && !bGta) return -1;
          if (!aGta && bGta) return 1;

          if (a.isLive && !b.isLive) return -1;
          if (!a.isLive && b.isLive) return 1;

          return (b.viewers || 0) - (a.viewers || 0);
        });
        break;
    }

    this.filteredStreamers = results;
    this.renderStreamers();
  },

  renderStreamers() {
    const grid = document.getElementById('streamers-grid');
    const empty = document.getElementById('streamers-empty');
    if (!grid) return;

    if (this.filteredStreamers.length === 0) {
      grid.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    grid.innerHTML = this.filteredStreamers.map(s => this.renderStreamerCard(s)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
  },

  renderStreamerCard(s) {
    const safeName = typeof sanitize === 'function' ? sanitize(s.name) : s.name;
    const safeTitle = typeof sanitize === 'function' ? sanitize(s.title || '') : (s.title || '');
    const safeGame = typeof sanitize === 'function' ? sanitize(s.currentGame || '') : s.currentGame;
    const safeChannelUrl = typeof safeUrl === 'function' ? safeUrl(s.channelUrl) : (s.channelUrl || '#');
    const safeAvatarUrl = typeof safeUrl === 'function' ? safeUrl(s.avatar) : s.avatar;
    const safeThumbnail = s.thumbnail && typeof safeUrl === 'function' ? safeUrl(s.thumbnail) : s.thumbnail;
    const safeLogin = typeof sanitize === 'function' ? sanitize(s.channelLogin || '') : (s.channelLogin || '');

    const isKick = s.platform === 'kick';
    const isYoutube = s.platform === 'youtube';
    const isGta = s.isLive && (s.currentGame || '').toLowerCase().includes('grand theft auto');
    const platformPillClass = isKick ? 'pill-kick' : (isYoutube ? 'pill-youtube' : 'pill-twitch');
    const platformLabel = isKick ? 'KICK' : (isYoutube ? 'YOUTUBE' : 'TWITCH');
    const viewersCount = (parseInt(s.viewers, 10) || 0).toLocaleString('pl-PL');

    return `
      <article class="streamer-card ${s.isLive ? 'is-live' : ''}">
        <div class="streamer-card-header">
          <span class="streamer-pill ${platformPillClass}">${platformLabel}</span>
          ${s.isLive ? `
            <div class="flex items-center gap-1.5 font-mono text-[10px] text-neon-pink font-bold">
              <span class="pulse-dot"></span> LIVE // ${viewersCount}
            </div>
          ` : `
            <span class="font-mono text-[10px] text-slate-500">OFFLINE</span>
          `}
        </div>

        ${s.isLive && safeThumbnail ? `
          <a href="${safeChannelUrl}" target="_blank" rel="noopener noreferrer" class="streamer-live-media block relative group overflow-hidden" title="Oglądaj transmisję na żywo">
            <img src="${safeThumbnail}" alt="${safeName} live preview" class="streamer-live-img" loading="lazy" onerror="this.onerror=null;this.parentElement.style.display='none'">
            <div class="streamer-live-overlay">
              <span class="streamer-live-viewers-badge">
                <span class="pulse-dot"></span> 🔴 ${viewersCount}
              </span>
              <div class="streamer-live-play-icon">
                <i data-lucide="play" class="w-5 h-5 text-white"></i>
              </div>
            </div>
          </a>
        ` : ''}

        <div class="streamer-card-body">
          <div class="flex items-center gap-3 mb-3">
            <img src="${safeAvatarUrl}" alt="${safeName}" class="streamer-avatar" loading="lazy" onerror="this.onerror=null;this.src='img/logo-vi.png'">
            <div class="overflow-hidden">
              <h3 class="streamer-name truncate">${safeName}</h3>
              <p class="streamer-role text-[11px] text-slate-400 font-mono">@${safeLogin}</p>
            </div>
          </div>

          <div class="streamer-server-box">
            <span class="text-[10px] text-slate-500 uppercase font-mono block">Aktualny status:</span>
            <span class="text-xs ${isGta ? 'text-neon-pink' : 'text-neon-cyan'} font-bold font-mono truncate block">
              ${s.isLive ? (isGta ? `🎮 GTA V // ${safeGame}` : `🕹️ ${safeGame}`) : (isKick ? '🟢 Kanał KICK' : '💤 Kanał Offline')}
            </span>
          </div>

          ${s.isLive && safeTitle ? `
            <p class="text-[11px] text-slate-300 font-mono mt-2 truncate" title="${safeTitle}">
              "${safeTitle}"
            </p>
          ` : ''}
        </div>

        <div class="streamer-card-footer">
          <a href="${safeChannelUrl}" target="_blank" rel="noopener noreferrer" class="streamer-btn">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            <span>OGLĄDAJ TRANSMISJĘ</span>
          </a>
        </div>
      </article>
    `;
  },

  renderClips() {
    const grid = document.getElementById('clips-grid');
    const empty = document.getElementById('clips-empty');
    if (!grid) return;

    let filteredClips = [...this.clips];
    const now = Date.now();

    // Filtry czasowe (zabezpieczone przed przyszłymi datami)
    const periods = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };
    const periodMs = periods[this.activeClipTime];
    if (periodMs) {
      filteredClips = filteredClips.filter(c => {
        const time = new Date(c.createdAt || '').getTime();
        const diff = now - time;
        return !isNaN(time) && diff >= 0 && diff <= periodMs;
      });
    }

    filteredClips.sort((a, b) => {
      if (this.activeClipSort === 'newest') {
        return this.getClipTimestamp(b) - this.getClipTimestamp(a);
      }
      return (b.views || 0) - (a.views || 0) ||
        (b.votes || 0) - (a.votes || 0) ||
        this.getClipTimestamp(b) - this.getClipTimestamp(a);
    });

    if (filteredClips.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-12 px-4 bg-[#0d121f]/50 border border-white/5 rounded-xl">
          <div class="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-3 text-neon-cyan">
            <i data-lucide="film" class="w-6 h-6"></i>
          </div>
          <h4 class="font-display text-lg text-white tracking-wide uppercase mb-1">Brak klipów w tym okresie</h4>
          <p class="font-mono text-xs text-slate-400 max-w-sm mx-auto mb-4">To są przykładowe klipy z wybranych kanałów Twitch i Kick. Możesz też zgłosić własny klip do weryfikacji.</p>
          <button type="button" id="clips-empty-submit-btn" class="btn-secondary text-xs py-2 px-4 inline-flex items-center gap-2 cursor-pointer">
            <i data-lucide="plus-circle" class="w-4 h-4 text-neon-cyan"></i>
            <span>DODAJ PIERWSZY KLIP</span>
          </button>
        </div>
      `;
      const emptySubmitBtn = document.getElementById('clips-empty-submit-btn');
      if (emptySubmitBtn) {
        emptySubmitBtn.addEventListener('click', () => ClipApplicationModal.open());
      }
      if (empty) empty.classList.add('hidden');
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });
      return;
    }

    if (empty) empty.classList.add('hidden');

    grid.innerHTML = filteredClips.map((clip, index) => this.renderClipCard(clip, index + 1)).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: grid });

    // Podepnij akcje kliknięcia w odtwarzacz i głosowanie
    grid.querySelectorAll('.clip-play-action').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const clipId = el.dataset.clipId;
        const clip = this.clips.find(c => c.id === clipId);
        if (clip) ClipViewerModal.open(clip);
      });
    });

    grid.querySelectorAll('.clip-vote-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const clipId = btn.dataset.clipId;
        this.handleClipVote(clipId, btn);
      });
    });
  },

  getClipTimestamp(clip) {
    const timestamp = Date.parse(clip?.createdAt || '');
    return Number.isNaN(timestamp) ? 0 : timestamp;
  },

  withFeaturedKickClips(clips) {
    const existingIds = new Set(clips.map(clip => clip?.id).filter(Boolean));
    const featuredKickClips = this.FEATURED_KICK_CLIPS
      .filter(clip => !existingIds.has(clip.id))
      .map(clip => ({ ...clip }));
    return [...clips, ...featuredKickClips];
  },

  renderClipCard(clip, rank) {
    const safeTitle = typeof sanitize === 'function' ? sanitize(clip.title) : clip.title;
    const safeStreamer = typeof sanitize === 'function' ? sanitize(clip.streamer) : clip.streamer;
    const safeServer = clip.server ? (typeof sanitize === 'function' ? sanitize(clip.server) : clip.server) : null;
    const safeDuration = typeof sanitize === 'function' ? sanitize(clip.duration || '0:45') : clip.duration;
    const safeViews = (parseInt(clip.views, 10) || 0).toLocaleString('pl-PL');
    const safeVotes = parseInt(clip.votes, 10) || 0;
    const safeAvatar = typeof safeUrl === 'function' ? safeUrl(clip.streamerAvatar) : clip.streamerAvatar;
    const safeThumb = typeof safeUrl === 'function' ? safeUrl(clip.thumbnail) : clip.thumbnail;
    const safeClipId = typeof sanitize === 'function' ? sanitize(clip.id) : clip.id;
    const hasVoted = this.userVotedClips.has(clip.id);
    const sampleBadge = clip.isFeaturedSample
      ? '<span class="absolute top-2 right-2 rounded bg-emerald-500/90 px-2 py-1 text-[9px] font-bold text-black">PRZYKŁADOWY KICK</span>'
      : '';

    let rankBadge = '';
    if (rank === 1) {
      rankBadge = '<span class="clip-rank-badge rank-1">🏆 #1 TOP KLIP</span>';
    } else if (rank === 2) {
      rankBadge = '<span class="clip-rank-badge rank-2">🥈 #2 TOP</span>';
    } else if (rank === 3) {
      rankBadge = '<span class="clip-rank-badge rank-3">🥉 #3 TOP</span>';
    } else {
      rankBadge = `<span class="clip-rank-badge font-mono">#${rank}</span>`;
    }

    return `
      <div class="clip-card" data-clip-id="${safeClipId}">
        <div class="clip-thumb-box clip-play-action cursor-pointer" data-clip-id="${safeClipId}" style="background-image: url('${safeThumb}');">
          ${rankBadge}
          ${sampleBadge}
          <div class="clip-duration">${safeDuration}</div>
          <div class="clip-play-overlay">
            <i data-lucide="play" class="w-5 h-5 text-white fill-white"></i>
          </div>
          <div class="clip-views-badge">
            <i data-lucide="eye" class="w-3 h-3"></i>
            <span>${safeViews}</span>
          </div>
        </div>

        <div class="clip-body">
          <h4 class="clip-title clip-play-action cursor-pointer hover:text-neon-cyan transition-colors" data-clip-id="${safeClipId}" title="${safeTitle}">
            ${safeTitle}
          </h4>

          <div class="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div class="flex items-center gap-2 overflow-hidden">
              <img src="${safeAvatar}" alt="${safeStreamer}" class="w-6 h-6 rounded-full border border-white/20 object-cover" onerror="this.onerror=null;this.src='img/logo-vi.png'">
              <div class="overflow-hidden">
                <span class="text-xs font-bold text-slate-200 block truncate">${safeStreamer}</span>
                ${safeServer ? `<span class="text-[10px] text-slate-400 font-mono block truncate">${safeServer}</span>` : ''}
              </div>
            </div>

            <button type="button" class="clip-vote-btn ${hasVoted ? 'voted' : ''}" data-clip-id="${safeClipId}" title="${hasVoted ? 'Oddałeś głos na ten klip' : 'Zagłosuj na ten klip'}" aria-label="${hasVoted ? `Cofnij głos na klip ${safeTitle}` : `Zagłosuj na klip ${safeTitle}`}">
              <i data-lucide="flame" class="w-4 h-4 ${hasVoted ? 'text-neon-pink fill-neon-pink' : 'text-slate-400'}"></i>
              <span class="clip-vote-count font-mono font-bold text-xs ${hasVoted ? 'text-neon-pink' : 'text-slate-300'}">${safeVotes}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  handleClipVote(clipId, btnElement) {
    const clip = this.clips.find(c => c.id === clipId);
    if (!clip) return;

    if (this.userVotedClips.has(clipId)) {
      // Cofnij głos
      this.userVotedClips.delete(clipId);
      clip.votes = Math.max(0, (clip.votes || 0) - 1);
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Cofnięto głos na klip.', 'info');
      }
    } else {
      // Dodaj głos
      this.userVotedClips.add(clipId);
      clip.votes = (clip.votes || 0) + 1;
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Oddano głos na najlepszy klip! 🔥', 'success');
      }
    }

    this.saveVotedClips();

    // Zapisz stan liczników w localStorage
    try {
      const raw = localStorage.getItem('virp_clip_vote_counts');
      const localVotes = raw ? JSON.parse(raw) : {};
      if (localVotes && typeof localVotes === 'object' && !Array.isArray(localVotes)) {
        localVotes[clipId] = clip.votes;
        localStorage.setItem('virp_clip_vote_counts', JSON.stringify(localVotes));
      }
    } catch (_) {}

    // Optymalizacja aktualizacji DOM bez niszczenia całej siatki
    if (btnElement) {
      const hasVotedNow = this.userVotedClips.has(clipId);
      btnElement.classList.toggle('voted', hasVotedNow);
      const countEl = btnElement.querySelector('.clip-vote-count');
      if (countEl) {
        countEl.textContent = clip.votes;
        countEl.className = `clip-vote-count font-mono font-bold text-xs ${hasVotedNow ? 'text-neon-pink' : 'text-slate-300'}`;
      }
      const iconEl = btnElement.querySelector('i, svg');
      if (iconEl) {
        iconEl.setAttribute('class', `w-4 h-4 ${hasVotedNow ? 'text-neon-pink fill-neon-pink' : 'text-slate-400'}`);
      }
    } else {
      this.renderClips();
    }

    // Jeśli otwarty jest podgląd tego klipu, zaktualizuj też licznik w modalu
    ClipViewerModal.updateVoteState(clip);
  }
};

/* ============================================================
   VIRP.pl — TOP 3 Barter & Spotlight Info Modal (Top3InfoModal)
   ============================================================ */
const Top3InfoModal = {
  modal: null,
  closeBtn: null,
  closeActionBtn: null,
  applyBtn: null,

  init() {
    this.modal = document.getElementById('top3-info-modal');
    if (!this.modal) return;
    this.closeBtn = document.getElementById('top3-info-modal-close-btn');
    this.closeActionBtn = document.getElementById('top3-modal-close-action-btn');
    this.applyBtn = document.getElementById('top3-modal-apply-btn');

    this.bindEvents();
  },

  bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    if (this.closeActionBtn) {
      this.closeActionBtn.addEventListener('click', () => this.close());
    }
    if (this.applyBtn) {
      this.applyBtn.addEventListener('click', () => {
        this.close();
        StreamerApplicationModal.open();
      });
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal && this.modal.classList.contains('open')) {
        this.close();
      }
    });

    // Delegacja kliknięć w przyciski otwierające modal informacji TOP 3
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#open-top3-info-btn, #top3-empty-how-btn, [data-action="open-top3-info"]');
      if (btn) {
        e.preventDefault();
        this.open();
      }
      const emptyApply = e.target.closest('#top3-empty-apply-btn');
      if (emptyApply) {
        e.preventDefault();
        StreamerApplicationModal.open();
      }
    });
  },

  open() {
    if (!this.modal) return;
    this.modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons({ root: this.modal });
  },

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('open');
    const portal = document.getElementById('streamers-portal');
    if (!portal || portal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }
};

/* ============================================================
   VIRP.pl — Streamer Application Modal (StreamerApplicationModal)
   Formularz zgłoszeniowy dla twórców z integracją DISCORD_WEBHOOK_2
   ============================================================ */
const StreamerApplicationModal = {
  SUBMIT_URL: 'https://virp-proxy.chojmarcel.workers.dev/api/streamer-submit',
  COOLDOWN_KEY: 'virp_streamer_submit_cooldown',
  COOLDOWN_MS: 5 * 60 * 1000,

  init() {
    this.modal = document.getElementById('add-streamer-modal');
    this.form = document.getElementById('add-streamer-form');
    this.openBtn = document.getElementById('open-streamer-modal-btn');
    this.closeBtn = document.getElementById('streamer-modal-close-btn');

    if (!this.modal || !this.form) return;

    this.bindEvents();
  },

  bindEvents() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    // Zamknięcie kliknięciem poza treść modala
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Zamknięcie klawiszem Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('open')) {
        this.close();
      }
    });

    // Licznik znaków opisu
    const descInput = document.getElementById('form-streamer-desc');
    const descCount = document.getElementById('form-streamer-desc-count');
    if (descInput && descCount) {
      descInput.addEventListener('input', () => {
        descCount.textContent = descInput.value.length;
      });
    }

    // Obsługa wysyłania formularza
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  },

  open() {
    if (!this.modal) return;
    this.modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Leniwe renderowanie Cloudflare Turnstile przy otwarciu okna
    if (typeof VIRP !== 'undefined' && typeof VIRP.renderTurnstile === 'function') {
      VIRP.renderTurnstile('turnstile-streamer-container');
    }

    setTimeout(() => {
      const firstInput = document.getElementById('form-streamer-name');
      if (firstInput) firstInput.focus();
    }, 200);

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: this.modal });
  },

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('open');
    const portal = document.getElementById('streamers-portal');
    if (!portal || portal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  },

  isOnCooldown() {
    try {
      const last = localStorage.getItem(this.COOLDOWN_KEY);
      if (!last) return false;
      const time = parseInt(last, 10);
      if (isNaN(time)) {
        localStorage.removeItem(this.COOLDOWN_KEY);
        return false;
      }
      return (Date.now() - time) < this.COOLDOWN_MS;
    } catch (_) {
      return false;
    }
  },

  getRemainingCooldown() {
    try {
      const last = localStorage.getItem(this.COOLDOWN_KEY);
      if (!last) return '0s';
      const time = parseInt(last, 10);
      if (isNaN(time)) return '0s';
      const diff = Math.max(0, this.COOLDOWN_MS - (Date.now() - time));
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } catch (_) {
      return '0s';
    }
  },

  showFieldError(fieldId, message) {
    const errEl = document.getElementById(`error-streamer-${fieldId}`);
    const inputEl = document.getElementById(`form-streamer-${fieldId}`);
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.remove('hidden');
    }
    if (inputEl) {
      inputEl.classList.add('error');
    }
  },

  resetErrors() {
    this.form.querySelectorAll('.form-error').forEach(el => {
      el.classList.add('hidden');
      el.textContent = '';
    });
    this.form.querySelectorAll('.error').forEach(el => {
      el.classList.remove('error');
    });
  },

  isValidUrl(string) {
    try {
      const url = new URL(string.trim().startsWith('http') ? string.trim() : `https://${string.trim()}`);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  },

  validate() {
    this.resetErrors();
    let valid = true;

    const name = document.getElementById('form-streamer-name')?.value?.trim() || '';
    if (!name || name.length < 2) {
      this.showFieldError('name', 'Podaj nick twórcy (min. 2 znaki)');
      valid = false;
    }

    const platform = document.getElementById('form-streamer-platform')?.value || '';
    if (!platform) {
      this.showFieldError('platform', 'Wybierz platformę streamingową');
      valid = false;
    }

    const game = document.getElementById('form-streamer-game')?.value?.trim() || '';
    if (!game || game.length < 2) {
      this.showFieldError('game', 'Podaj główną kategorię / grę (np. GTA V RP)');
      valid = false;
    }

    const url = document.getElementById('form-streamer-url')?.value?.trim() || '';
    if (!url) {
      this.showFieldError('url', 'Podaj bezpośredni link do kanału');
      valid = false;
    } else if (!this.isValidUrl(url)) {
      this.showFieldError('url', 'Podaj poprawny URL (np. https://kick.com/... lub https://twitch.tv/...)');
      valid = false;
    }

    return valid;
  },

  async handleSubmit() {
    if (this.isSubmitting) return;

    // Honeypot check
    const hp = document.getElementById('form-streamer-hp')?.value?.trim();
    if (hp) {
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Wystąpił błąd podczas wysyłania zgłoszenia.', 'error');
      }
      return;
    }

    // Cooldown check
    if (this.isOnCooldown()) {
      const rem = this.getRemainingCooldown();
      const msg = `Poczekaj jeszcze ${rem} przed wysłaniem kolejnego zgłoszenia twórcy.`;
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(msg, 'info');
      } else {
        alert(msg);
      }
      return;
    }

    if (!this.validate()) return;

    const turnstileToken = document.querySelector('#add-streamer-form [name="cf-turnstile-response"]')?.value || '';
    if (!turnstileToken) {
      const msg = 'Potwierdź weryfikację anty-bot Turnstile przed wysłaniem formularza.';
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(msg, 'error');
      } else {
        alert(msg);
      }
      return;
    }

    this.isSubmitting = true;

    const rawUrl = document.getElementById('form-streamer-url')?.value?.trim() || '';
    const safeChannelUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    const hpValue = document.getElementById('form-streamer-hp')?.value?.trim() || '';
    const payload = {
      name: document.getElementById('form-streamer-name')?.value?.trim() || '',
      platform: document.getElementById('form-streamer-platform')?.value || 'kick',
      game: document.getElementById('form-streamer-game')?.value?.trim() || '',
      channelUrl: safeChannelUrl,
      viewers: document.getElementById('form-streamer-viewers')?.value?.trim() || '',
      description: document.getElementById('form-streamer-desc')?.value?.trim() || '',
      hp: hpValue,
      streamer_hp_check: hpValue,
      turnstileToken: turnstileToken,
      submittedAt: new Date().toISOString()
    };

    const submitBtn = document.getElementById('form-streamer-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <span>Wysyłanie zgłoszenia...</span>
      `;
    }

    try {
      const res = await fetch(this.SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      let json = {};
      try {
        json = await res.json();
      } catch (_) {}

      if (!res.ok) {
        throw new Error(json.error || `Błąd serwera (HTTP ${res.status})`);
      }

      try {
        localStorage.setItem(this.COOLDOWN_KEY, Date.now().toString());
      } catch (_) {}

      const successMsg = 'Zgłoszenie twórcy wysłane do weryfikacji! 🎉';
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(successMsg, 'success');
      } else {
        alert(successMsg);
      }

      this.form.reset();
      const descCount = document.getElementById('form-streamer-desc-count');
      if (descCount) descCount.textContent = '0';
      this.close();

    } catch (err) {
      console.error('[StreamerModal] Błąd wysyłania:', err);
      const errMsg = err.message || 'Wystąpił błąd podczas wysyłania zgłoszenia.';
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(errMsg, 'error');
      } else {
        alert(errMsg);
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <i data-lucide="send" class="w-4 h-4"></i>
          <span>Wyślij Zgłoszenie Twórcy</span>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: submitBtn });
      }
      if (typeof VIRP !== 'undefined' && typeof VIRP.resetTurnstile === 'function') {
        VIRP.resetTurnstile('turnstile-streamer-container');
      }
    }
  }
};

/* ============================================================
   VIRP.pl — Community Clip Submission Modal (ClipApplicationModal)
   Zgłoszenia klipów z integracją DISCORD_WEBHOOK_3
   ============================================================ */
const ClipApplicationModal = {
  SUBMIT_URL: 'https://virp-proxy.chojmarcel.workers.dev/api/clip-submit',
  COOLDOWN_KEY: 'virp_clip_submit_cooldown',
  COOLDOWN_MS: 5 * 60 * 1000,
  ALLOWED_DOMAINS: [
    'twitch.tv',
    'clips.twitch.tv',
    'kick.com',
    'youtube.com',
    'youtu.be',
    'medal.tv',
    'streamable.com',
    'tiktok.com'
  ],

  init() {
    this.modal = document.getElementById('add-clip-modal');
    this.form = document.getElementById('add-clip-form');
    this.openBtn = document.getElementById('open-clip-modal-btn');
    this.closeBtn = document.getElementById('clip-modal-close-btn');

    if (!this.modal || !this.form) return;

    this.bindEvents();
  },

  bindEvents() {
    if (this.openBtn) {
      this.openBtn.addEventListener('click', () => this.open());
    }

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('open')) {
        this.close();
      }
    });

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  },

  open() {
    if (!this.modal) return;
    this.modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Leniwe renderowanie Cloudflare Turnstile przy otwarciu okna
    if (typeof VIRP !== 'undefined' && typeof VIRP.renderTurnstile === 'function') {
      VIRP.renderTurnstile('turnstile-clip-container');
    }

    setTimeout(() => {
      const firstInput = document.getElementById('form-clip-url');
      if (firstInput) firstInput.focus();
    }, 200);

    if (typeof lucide !== 'undefined') lucide.createIcons({ root: this.modal });
  },

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('open');
    const portal = document.getElementById('streamers-portal');
    if (!portal || portal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  },

  isOnCooldown() {
    try {
      const last = localStorage.getItem(this.COOLDOWN_KEY);
      if (!last) return false;
      const time = parseInt(last, 10);
      if (isNaN(time)) {
        localStorage.removeItem(this.COOLDOWN_KEY);
        return false;
      }
      return (Date.now() - time) < this.COOLDOWN_MS;
    } catch (_) {
      return false;
    }
  },

  getRemainingCooldown() {
    try {
      const last = localStorage.getItem(this.COOLDOWN_KEY);
      if (!last) return '0s';
      const time = parseInt(last, 10);
      if (isNaN(time)) return '0s';
      const diff = Math.max(0, this.COOLDOWN_MS - (Date.now() - time));
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    } catch (_) {
      return '0s';
    }
  },

  showFieldError(fieldId, message) {
    const errEl = document.getElementById(`error-clip-${fieldId}`);
    const inputEl = document.getElementById(`form-clip-${fieldId}`);
    if (errEl) {
      errEl.textContent = message;
      errEl.classList.remove('hidden');
    }
    if (inputEl) {
      inputEl.classList.add('error');
    }
  },

  resetErrors() {
    this.form.querySelectorAll('.form-error').forEach(el => {
      el.classList.add('hidden');
      el.textContent = '';
    });
    this.form.querySelectorAll('.error').forEach(el => {
      el.classList.remove('error');
    });
  },

  validateClipDomain(urlStr) {
    try {
      const parsed = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
      return this.ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
    } catch (_) {
      return false;
    }
  },

  validate() {
    this.resetErrors();
    let valid = true;

    const url = document.getElementById('form-clip-url')?.value?.trim() || '';
    if (!url) {
      this.showFieldError('url', 'Wklej bezpośredni link do klipu');
      valid = false;
    } else if (!this.validateClipDomain(url)) {
      this.showFieldError('url', 'Obsługiwane platformy: Twitch, Kick, YouTube, Medal.tv, Streamable, TikTok.');
      valid = false;
    }

    const title = document.getElementById('form-clip-title')?.value?.trim() || '';
    if (!title || title.length < 3) {
      this.showFieldError('title', 'Podaj chwytliwy tytuł akcji (min. 3 znaki)');
      valid = false;
    }

    const streamer = document.getElementById('form-clip-streamer')?.value?.trim() || '';
    if (!streamer || streamer.length < 2) {
      this.showFieldError('streamer', 'Podaj nick twórcy ze streamu');
      valid = false;
    }

    return valid;
  },

  async handleSubmit() {
    if (this.isSubmitting) return;

    // Honeypot check
    const hp = document.getElementById('form-clip-hp')?.value?.trim();
    if (hp) {
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Wystąpił błąd podczas wysyłania zgłoszenia.', 'error');
      }
      return;
    }

    if (this.isOnCooldown()) {
      const rem = this.getRemainingCooldown();
      const msg = `Poczekaj jeszcze ${rem} przed zgłoszeniem kolejnego klipu.`;
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(msg, 'info');
      } else {
        alert(msg);
      }
      return;
    }

    if (!this.validate()) return;

    const turnstileToken = document.querySelector('#add-clip-form [name="cf-turnstile-response"]')?.value || '';
    if (!turnstileToken) {
      const msg = 'Potwierdź weryfikację anty-bot Turnstile przed wysłaniem klipu.';
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(msg, 'error');
      } else {
        alert(msg);
      }
      return;
    }

    this.isSubmitting = true;

    const rawUrl = document.getElementById('form-clip-url')?.value?.trim() || '';
    const safeClipUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

    const hpValue = document.getElementById('form-clip-hp')?.value?.trim() || '';
    const payload = {
      clipUrl: safeClipUrl,
      title: document.getElementById('form-clip-title')?.value?.trim() || '',
      streamerName: document.getElementById('form-clip-streamer')?.value?.trim() || '',
      serverName: document.getElementById('form-clip-server')?.value?.trim() || '',
      submitterName: document.getElementById('form-clip-submitter')?.value?.trim() || '',
      hp: hpValue,
      clip_hp_check: hpValue,
      turnstileToken: turnstileToken,
      submittedAt: new Date().toISOString()
    };

    const submitBtn = document.getElementById('form-clip-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        <span>Wysyłanie klipu...</span>
      `;
    }

    try {
      const res = await fetch(this.SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      let json = {};
      try {
        json = await res.json();
      } catch (_) {}

      if (!res.ok) {
        throw new Error(json.error || `Błąd serwera (HTTP ${res.status})`);
      }

      try {
        localStorage.setItem(this.COOLDOWN_KEY, Date.now().toString());
      } catch (_) {}

      const successMsg = 'Klip został wysłany do weryfikacji! 🎉';
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(successMsg, 'success');
      } else {
        alert(successMsg);
      }

      this.form.reset();
      this.close();

    } catch (err) {
      console.error('[ClipModal] Błąd wysyłania:', err);
      const errMsg = err.message || 'Wystąpił błąd podczas wysyłania klipu.';
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(errMsg, 'error');
      } else {
        alert(errMsg);
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <i data-lucide="send" class="w-4 h-4"></i>
          <span>Wyślij Klip do Weryfikacji</span>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: submitBtn });
      }
      if (typeof VIRP !== 'undefined' && typeof VIRP.resetTurnstile === 'function') {
        VIRP.resetTurnstile('turnstile-clip-container');
      }
    }
  }
};

/* ============================================================
   VIRP.pl — Community Clip Player Modal (ClipViewerModal)
   Odtwarzacz wideo z obsługą osadzania Twitch/Kick/YouTube/itp.
   ============================================================ */
const ClipViewerModal = {
  currentClip: null,

  init() {
    this.modal = document.getElementById('clip-viewer-modal');
    this.closeBtn = document.getElementById('clip-viewer-close-btn');
    this.titleEl = document.getElementById('clip-viewer-title');
    this.containerEl = document.getElementById('clip-viewer-player-container');
    this.streamerEl = document.getElementById('clip-viewer-streamer');
    this.voteBtn = document.getElementById('clip-viewer-vote-btn');
    this.voteCountEl = document.getElementById('clip-viewer-vote-count');
    this.externalLink = document.getElementById('clip-viewer-external-link');

    if (!this.modal) return;

    this.bindEvents();
  },

  bindEvents() {
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }

    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('open')) {
        this.close();
      }
    });

    if (this.voteBtn) {
      this.voteBtn.addEventListener('click', () => {
        if (this.currentClip) {
          StreamersHub.handleClipVote(this.currentClip.id, this.voteBtn);
        }
      });
    }
  },

  open(clip) {
    if (!this.modal || !clip) return;
    this.currentClip = clip;

    const safeTitle = typeof sanitize === 'function' ? sanitize(clip.title) : clip.title;
    const safeStreamer = typeof sanitize === 'function' ? sanitize(clip.streamer) : clip.streamer;
    const safeServer = clip.server ? (typeof sanitize === 'function' ? sanitize(clip.server) : clip.server) : null;
    const safeUrlStr = typeof safeUrl === 'function' ? safeUrl(clip.url) : clip.url;
    const safeAvatar = typeof safeUrl === 'function' ? safeUrl(clip.streamerAvatar) : clip.streamerAvatar;

    if (this.titleEl) this.titleEl.textContent = safeTitle;
    if (this.streamerEl) {
      this.streamerEl.innerHTML = `
        <div class="flex items-center gap-2">
          <img src="${safeAvatar}" alt="${safeStreamer}" class="w-6 h-6 rounded-full border border-white/20 object-cover" onerror="this.onerror=null;this.src='img/logo-vi.png'">
          <span class="font-bold text-white">${safeStreamer}</span>
          ${safeServer ? `<span class="text-neon-cyan font-mono text-[11px]">• ${safeServer}</span>` : ''}
        </div>
      `;
    }

    if (this.externalLink) {
      this.externalLink.href = safeUrlStr;
    }

    this.updateVoteState(clip);

    // Wygeneruj odtwarzacz iframe lub interaktywny embed
    this.renderPlayer(clip);

    this.modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined' && this.modal) lucide.createIcons({ root: this.modal });
  },

  updateVoteState(clip) {
    if (!this.voteBtn || !this.voteCountEl || !clip) return;
    const hasVoted = StreamersHub.userVotedClips.has(clip.id);
    this.voteCountEl.textContent = clip.votes || 0;
    if (hasVoted) {
      this.voteBtn.classList.add('btn-vice');
      this.voteBtn.classList.remove('btn-secondary');
    } else {
      this.voteBtn.classList.add('btn-secondary');
      this.voteBtn.classList.remove('btn-vice');
    }
  },

  renderPlayer(clip) {
    if (!this.containerEl) return;
    const url = clip.url || '';
    const safeThumb = typeof safeUrl === 'function' ? safeUrl(clip.thumbnail) : clip.thumbnail;
    const safeUrlStr = typeof safeUrl === 'function' ? safeUrl(clip.url) : clip.url;
    const rawPlatform = clip.platform ? String(clip.platform).toUpperCase() : 'WIDEO';
    const safePlatform = typeof sanitize === 'function' ? sanitize(rawPlatform) : rawPlatform;

    // 1. YouTube Video / Shorts / Clip
    const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|clip\/))([\w-]{11})/);
    if (ytMatch && ytMatch[1]) {
      this.containerEl.innerHTML = `
        <iframe class="w-full h-full border-0" src="https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"></iframe>
      `;
      return;
    }

    // 2. Twitch Clip
    const twitchClipMatch = url.match(/(?:clips\.twitch\.tv\/|twitch\.tv\/[\w-]+\/clip\/)([\w-]+)/);
    if (twitchClipMatch && twitchClipMatch[1]) {
      const currentHost = window.location.hostname || 'localhost';
      const parents = currentHost === 'virp.pl' ? 'parent=virp.pl' : `parent=${currentHost}&parent=virp.pl`;
      this.containerEl.innerHTML = `
        <iframe class="w-full h-full border-0" src="https://clips.twitch.tv/embed?clip=${twitchClipMatch[1]}&${parents}&autoplay=true" allow="fullscreen"></iframe>
      `;
      return;
    }

    // 3. Fallback: Karta podglądu z bezpośrednim przyciskiem otwarcia
    this.containerEl.innerHTML = `
      <div class="relative w-full h-full flex flex-col items-center justify-center p-6 text-center bg-cover bg-center" style="background-image: linear-gradient(rgba(6, 8, 15, 0.8), rgba(6, 8, 15, 0.9)), url('${safeThumb}');">
        <div class="max-w-md p-6 bg-[#0d121f]/90 border border-white/15 rounded-xl shadow-2xl backdrop-blur-md">
          <div class="w-14 h-14 rounded-full bg-gradient-to-tr from-neon-pink to-neon-cyan flex items-center justify-center mx-auto mb-4 shadow-lg shadow-pink-500/30">
            <i data-lucide="play" class="w-7 h-7 text-white fill-white ml-0.5"></i>
          </div>
          <h3 class="text-base font-bold text-white mb-2 font-display uppercase tracking-wider">${typeof sanitize === 'function' ? sanitize(clip.title) : clip.title}</h3>
          <p class="text-xs text-slate-300 font-mono mb-4">Platforma ${safePlatform} wymaga odtworzenia bezpośrednio na kanale twórcy.</p>
          <a href="${safeUrlStr}" target="_blank" rel="noopener noreferrer" class="btn-primary py-3 px-6 text-xs w-full flex items-center justify-center gap-2">
            <i data-lucide="external-link" class="w-4 h-4"></i>
            <span>OTWÓRZ KLIP NA ${safePlatform}</span>
          </a>
        </div>
      </div>
    `;
  },

  close() {
    if (!this.modal) return;
    this.modal.classList.remove('open');
    if (this.containerEl) {
      const iframe = this.containerEl.querySelector('iframe');
      if (iframe) iframe.src = 'about:blank';
      this.containerEl.innerHTML = '';
    }
    const portal = document.getElementById('streamers-portal');
    if (!portal || portal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }
};

window.StreamersHub = StreamersHub;
window.StreamerApplicationModal = StreamerApplicationModal;
window.ClipApplicationModal = ClipApplicationModal;
window.ClipViewerModal = ClipViewerModal;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => StreamersHub.init());
} else {
  StreamersHub.init();
}
