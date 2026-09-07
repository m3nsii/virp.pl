/* ============================================================
   VIRP.pl — App Controller (app.js)
   Główny moduł inicjalizacji, nawigacji, bezpieczeństwa i animacji
   ============================================================ */

/* ----------------------------------------------------------
   FUNKCJE BEZPIECZEŃSTWA (Sanityzacja XSS i Bezpieczne URL)
   ---------------------------------------------------------- */

/**
 * Sanityzacja tekstu przed wstawieniem do HTML.
 * Escapuje znaki specjalne HTML, zapobiegając atakom XSS.
 * @param {string} str - Tekst do sanityzacji
 * @returns {string} Bezpieczny tekst HTML
 */
function sanitize(str) {
  if (str === null || str === undefined || str === '') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Bezpieczna walidacja i sanityzacja URL (zapobiega atakom javascript: protocol).
 * Dopuszcza wyłącznie protokoły http: oraz https:.
 * @param {string} url - Adres URL do weryfikacji
 * @returns {string} Bezpieczny URL lub pusty ciąg znaków
 */
function safeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim().replace(/['"`<>\\;]/g, '');
  if (trimmed.startsWith('//')) return '';

  try {
    const base = window.location.origin || 'https://virp.pl';
    const parsed = new URL(trimmed, base);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';

    // Zablokuj zewnętrzne pliki .svg ze względów bezpieczeństwa (SVG Stored XSS)
    if (parsed.pathname.toLowerCase().endsWith('.svg') && parsed.origin !== base) {
      return '';
    }

    return trimmed.startsWith('http://') || trimmed.startsWith('https://') ? parsed.href : trimmed;
  } catch (e) {
    return '';
  }
}

// Udostępnienie w przestrzeni globalnej i VIRP
window.sanitize = sanitize;
window.safeUrl = safeUrl;

/**
 * @namespace VIRP
 * @description Główna przestrzeń nazw aplikacji VIRP.pl
 */
const VIRP = {
  /** Wersja aplikacji */
  version: '1.2.2',

  /** Czy aplikacja jest zainicjalizowana */
  initialized: false,

  /** Narzędzia bezpieczeństwa */
  sanitize,
  safeUrl,

  /** Przechowywanie ID wyrenderowanych widgetów Turnstile (ochrona przed Prototype Pollution) */
  turnstileWidgets: Object.create(null),

  /**
   * Leniwe renderowanie Cloudflare Turnstile w danym kontenerze.
   * Renderuje widget dopiero po otwarciu danego okna modalnego.
   * @param {string} containerId - ID kontenera DOM
   * @returns {string|null} ID widgetu Turnstile
   */
  renderTurnstile(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return null;

    if (this.turnstileWidgets[containerId]) {
      return this.turnstileWidgets[containerId];
    }

    let attempts = 0;
    const maxAttempts = 25; // max 5 sekund oczekiwania (25 * 200ms)

    const doRender = () => {
      if (typeof window.turnstile !== 'undefined' && typeof window.turnstile.render === 'function') {
        try {
          const widgetId = window.turnstile.render(`#${containerId}`, {
            sitekey: '0x4AAAAAAEpglw3csmpYbMGa',
            theme: 'dark'
          });
          this.turnstileWidgets[containerId] = widgetId;
          return widgetId;
        } catch (e) {
          // Widget mógł już zostać zainicjalizowany
        }
      } else {
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(doRender, 200);
        } else {
          console.warn(`[VIRP] Przekroczono limit czasu oczekiwania na Turnstile dla #${containerId}`);
        }
      }
      return null;
    };

    return doRender();
  },

  /**
   * Resetowanie tokenu Turnstile po wysłaniu formularza
   * @param {string} containerId - ID kontenera DOM
   */
  resetTurnstile(containerId) {
    const widgetId = this.turnstileWidgets[containerId];
    if (widgetId && typeof window.turnstile !== 'undefined' && typeof window.turnstile.reset === 'function') {
      try {
        window.turnstile.reset(widgetId);
      } catch (_) {}
    }
  },

  /**
   * Inicjalizacja aplikacji — punkt wejścia
   */
  init() {
    if (this.initialized) return;
    this.initialized = true;

    console.log(`%c VIRP.pl v${this.version} %c Załadowano`, 
      'background: #ff2d78; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
      'color: #94a3b8;'
    );

    this.initLucideIcons();
    this.initSplashScreen();
    this.initNavigation();
    this.initScrollAnimations();
    this.initSmoothScroll();
    this.initHeroStats();
    this.initHeroGridOptimization();
    this.initRadioWidget();
    this.initGta6Portal();
    this.initContactModal();
    this.initPrivacyModal();
    this.initCookieConsent();
    this.initAnnouncementBar();
  },

  /* ----------------------------------------------------------
     NAWIGACJA
     ---------------------------------------------------------- */

  /**
   * Inicjalizacja nawigacji: sticky, mobilna, aktywne linki
   */
  initNavigation() {
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    // Sticky navbar shadow: lekki toggle klasy nav-scrolled tylko przy przekroczeniu progu (0 forced reflows)
    let isScrolled = false;
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 15;
      if (scrolled !== isScrolled) {
        isScrolled = scrolled;
        if (navbar) {
          navbar.classList.toggle('nav-scrolled', scrolled);
        }
      }
    }, { passive: true });

    // ScrollSpy oparty w 100% na natywnym IntersectionObserverze (brak odczytów layoutu w scrollu)
    this.initScrollSpy();

    // Mobile menu toggle
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener('click', () => {
        const isOpen = mobileMenu.classList.contains('open');
        mobileMenu.classList.toggle('open');
        
        mobileMenuBtn.setAttribute('aria-expanded', String(!isOpen));

        // Update icon (użycie 'i, svg' z powodu zamiany tagu przez Lucide)
        const icon = mobileMenuBtn.querySelector('i, svg');
        if (icon) {
          icon.setAttribute('data-lucide', isOpen ? 'menu' : 'x');
          if (typeof lucide !== 'undefined') lucide.createIcons({ root: mobileMenuBtn });
        }
      });

      // Close mobile menu when clicking a link
      mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          mobileMenu.classList.remove('open');
          mobileMenuBtn.setAttribute('aria-expanded', 'false');
          const icon = mobileMenuBtn.querySelector('i, svg');
          if (icon) {
            icon.setAttribute('data-lucide', 'menu');
            if (typeof lucide !== 'undefined') lucide.createIcons({ root: mobileMenuBtn });
          }
        });
      });
    }
  },

  /**
   * Pasek ogłoszeń i powiadomień na samej górze strony
   */
  initAnnouncementBar() {
    const bar = document.getElementById('top-announcement-bar');
    const closeBtn = document.getElementById('ticker-close-btn');
    const streamerLinks = document.querySelectorAll('.ticker-streamers-link');

    if (!bar) return;

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        bar.style.maxHeight = '0';
        bar.style.opacity = '0';
        bar.style.padding = '0';
        bar.style.overflow = 'hidden';
        bar.style.transition = 'all 0.3s ease';
        setTimeout(() => bar.remove(), 300);
      });
    }

    streamerLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.StreamersHub && window.StreamersHub.openPortal) {
          window.StreamersHub.openPortal();
        } else {
          window.location.hash = 'streamers';
        }
      });
    });
  },

  /**
   * ScrollSpy: w 100% asynchroniczny z użyciem IntersectionObserver
   * 0 zapytań o layout (offsetTop/offsetHeight) w trakcie przewijania strony!
   */
  _currentActiveNavId: '',
  _navObserver: null,

  initScrollSpy() {
    const navLinks = Array.from(document.querySelectorAll('.nav-link'));
    if (!navLinks.length) return;

    const sections = Array.from(document.querySelectorAll('section[id]:not(.sr-only)'));
    if (!sections.length) return;

    if ('IntersectionObserver' in window) {
      if (this._navObserver) {
        this._navObserver.disconnect();
      }

      this._navObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('id');
            this.setActiveNavLink(id, navLinks);
          }
        });
      }, {
        rootMargin: '-15% 0px -65% 0px',
        threshold: 0
      });

      sections.forEach(sec => this._navObserver.observe(sec));
    }
  },

  setActiveNavLink(id, navLinks) {
    if (!id || id === this._currentActiveNavId) return;
    this._currentActiveNavId = id;
    const links = navLinks || Array.from(document.querySelectorAll('.nav-link'));
    links.forEach(link => {
      if (link.getAttribute('href') === `#${id}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  },

  /* ----------------------------------------------------------
     SMOOTH SCROLL
     ---------------------------------------------------------- */

  /**
   * Smooth scroll dla linków wewnętrznych (anchor links)
   */
  initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const targetId = anchor.getAttribute('href');
        if (!targetId || targetId === '#' || targetId === '#streamers' || targetId === '#gta6') return;

        try {
          const target = document.querySelector(targetId);
          if (target) {
            e.preventDefault();
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        } catch (_) {}
      });
    });
  },

  /* ----------------------------------------------------------
     GTA VI PORTAL (LEONIDA & VICE CITY HUB)
     ---------------------------------------------------------- */

  /**
   * Inicjalizacja Portalu GTA VI (Leonida State Hub)
   */
  initGta6Portal() {
    const portal = document.getElementById('gta6-portal');
    if (!portal) return;

    window.Gta6Portal = {
      isOpen: false,
      portal,

      openPortal() {
        if (!portal) return;
        this.isOpen = true;
        // Zamknij portal streamerów jeśli otwarty
        if (typeof StreamersHub !== 'undefined' && StreamersHub.isOpen) {
          StreamersHub.closePortal();
        }
        portal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        portal.scrollTop = 0;

        if (window.location.hash !== '#gta6') {
          window.history.pushState(null, '', '#gta6');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: portal });
      },

      closePortal() {
        if (!portal) return;
        this.isOpen = false;
        portal.classList.add('hidden');
        document.body.style.overflow = '';

        if (window.location.hash === '#gta6') {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    };

    // Nawigacja — linki z href="#gta6"
    document.querySelectorAll('a[href="#gta6"]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.Gta6Portal.openPortal();
      });
    });

    // Przycisk powrotu / zamknięcia
    const closeBtn = document.getElementById('gta6-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => window.Gta6Portal.closePortal());
    }

    // Przyciski akcji wewnątrz portalu GTA VI
    const browseBtn = document.getElementById('gta6-browse-servers-btn');
    if (browseBtn) {
      browseBtn.addEventListener('click', () => {
        window.Gta6Portal.closePortal();
        const serversSec = document.getElementById('servers');
        if (serversSec) serversSec.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const addProjectBtn = document.getElementById('gta6-add-project-btn');
    if (addProjectBtn) {
      addProjectBtn.addEventListener('click', () => {
        window.Gta6Portal.closePortal();
        if (typeof AddServerModal !== 'undefined' && typeof AddServerModal.open === 'function') {
          AddServerModal.open();
        }
      });
    }

    // Obsługa Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && window.Gta6Portal.isOpen) {
        const anyModalOpen = document.querySelector('.modal-overlay.open');
        if (!anyModalOpen) {
          window.Gta6Portal.closePortal();
        }
      }
    });

    // Hash check — przekierowanie starych linków #gta6 na dedykowaną podstronę /gta6
    const checkGta6Hash = () => {
      if (window.location.hash === '#gta6') {
        window.location.href = 'gta6';
      }
    };

    window.addEventListener('hashchange', checkGta6Hash);
    window.addEventListener('popstate', checkGta6Hash);
    checkGta6Hash();
  },

  /* ----------------------------------------------------------
     SCROLL ANIMATIONS (IntersectionObserver)
     ---------------------------------------------------------- */

  /**
   * Inicjalizacja animacji wejścia elementów (fade + slide up)
   */
  initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Unobserve po pierwszym pokazaniu (jednorazowa animacja)
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    // Obserwuj elementy z klasą .animate-slide-up
    document.querySelectorAll('.animate-slide-up').forEach(el => {
      observer.observe(el);
    });
  },

  /* ----------------------------------------------------------
     LUCIDE ICONS
     ---------------------------------------------------------- */

  /**
   * Inicjalizacja ikon Lucide
   */
  initLucideIcons() {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  },

  /* ----------------------------------------------------------
     HERO STATS (Counter Animation)
     ---------------------------------------------------------- */

  /**
   * Animacja liczników w sekcji Hero
   */
  initHeroStats() {
    const statsSection = document.querySelector('.hero-stats');
    if (!statsSection) return;

    this._heroStatsVisible = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._heroStatsVisible = true;
          if (this._heroStats) {
            this.animateHeroStats();
            observer.unobserve(entry.target);
          }
        }
      });
    }, { threshold: 0.5 });

    observer.observe(statsSection);
  },

  /**
   * Automatyczne wstrzymanie animacji siatki 3D, gdy sekcja Hero jest poza ekranem
   * Oszczędza 100% obciążenia GPU podczas przeglądania katalogu i narzędzi!
   */
  initHeroGridOptimization() {
    const heroSection = document.getElementById('hero');
    const gridPlane = document.querySelector('.hero-grid-plane');
    if (!heroSection || !gridPlane || !('IntersectionObserver' in window)) return;

    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        gridPlane.classList.toggle('is-paused', !entry.isIntersecting);
      });
    }, { threshold: 0.02 });

    heroObserver.observe(heroSection);
  },

  /**
   * Aktualizacja i animacja statystyk Hero
   * @param {Object} stats - Obiekt ze statystykami {servers, slots, votes}
   */
  updateHeroStats(stats) {
    if (!stats || typeof stats !== 'object') return;
    this._heroStats = stats;
    if (this._heroStatsVisible) {
      this.animateHeroStats();
    }
  },

  /**
   * Animacja licznika (count up)
   */
  animateHeroStats() {
    const stats = this._heroStats;
    if (!stats) return;

    this.countUp('stat-servers', stats.servers, 1000);
    this.countUp('stat-slots', stats.slots, 1500);
    this.countUp('stat-votes', stats.votes, 2000);
  },

  /**
   * Animacja zliczania liczby od 0 do target
   * @param {string} elementId - ID elementu HTML
   * @param {number} target - Docelowa wartość
   * @param {number} duration - Czas trwania animacji (ms)
   */
  countUp(elementId, target, duration = 1200) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const numTarget = Number(target);
    if (isNaN(numTarget)) return;

    this._activeCountUps = this._activeCountUps || {};
    if (this._activeCountUps[elementId]) {
      cancelAnimationFrame(this._activeCountUps[elementId]);
    }

    const startTime = performance.now();
    const startValue = parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) || 0;

    if (startValue === numTarget) return;

    let lastRendered = startValue;
    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (numTarget - startValue) * eased);
      
      if (current !== lastRendered) {
        lastRendered = current;
        el.textContent = current.toLocaleString('pl-PL');
      }

      if (progress < 1) {
        this._activeCountUps[elementId] = requestAnimationFrame(update);
      } else {
        delete this._activeCountUps[elementId];
      }
    };

    this._activeCountUps[elementId] = requestAnimationFrame(update);
  },

  /* ----------------------------------------------------------
     SPLASH GATEWAY
     ---------------------------------------------------------- */

  /**
   * Obsługa ekranu wejściowego i odblokowanie audio
   */
  initSplashScreen() {
    // Definicja globalnej funkcji zwalniającej ekran powitalny
    window.dismissSplashGateway = () => {
      const splash = document.getElementById('splash-gate');
      const bgAudio = document.getElementById('bg-audio');
      const radioEq = document.getElementById('radio-eq');
      const radioStatus = document.getElementById('radio-track-status');
      const radioIcon = document.getElementById('radio-master-icon');

      // 1. Bezpieczny autostart audio
      if (bgAudio) {
        bgAudio.play().then(() => {
          if (radioIcon) radioIcon.setAttribute('data-lucide', 'pause');
          if (radioEq) radioEq.classList.add('is-playing');
          if (radioStatus) {
            radioStatus.textContent = 'ON AIR // CHILLSYNTH';
            radioStatus.style.color = '#00FF66';
          }
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }).catch((err) => console.log('Autoplay info:', err));
      }

      // 2. Płynne ukrycie bramki powitalnej
      if (splash) {
        splash.classList.add('is-dismissed');
        setTimeout(() => {
          if (splash.parentNode) splash.remove();
        }, 500);
      }
    };

    const enterBtn = document.getElementById('splash-enter-btn');
    if (enterBtn) {
      enterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.dismissSplashGateway();
      });
    }
  },

  /* ----------------------------------------------------------
     VICE CITY DUAL RADIO HUD CONTROLLER
     ---------------------------------------------------------- */

  /**
   * Inicjalizacja widżetu radia Dual Radio HUD
   */
  initRadioWidget() {
    const bgAudio = document.getElementById('bg-audio');
    const playBtn = document.getElementById('radio-master-play');
    const playIcon = document.getElementById('radio-master-icon');
    const trackTitle = document.getElementById('radio-track-title');
    const trackStatus = document.getElementById('radio-track-status');
    const radioEq = document.getElementById('radio-eq');
    
    const streamBtn = document.getElementById('src-stream-btn');
    const spotifyBtn = document.getElementById('src-spotify-btn');
    const expandBtn = document.getElementById('radio-expand-btn');
    const expandArrow = document.getElementById('radio-expand-arrow');
    const spotifyContainer = document.getElementById('radio-spotify-container');

    let currentSource = 'stream'; // 'stream' | 'spotify'

    // Funkcja zmiany źródła dźwięku
    const setSource = (source) => {
      currentSource = source;

      if (source === 'stream') {
        if (streamBtn) streamBtn.classList.add('active');
        if (spotifyBtn) spotifyBtn.classList.remove('active');
        if (spotifyContainer) spotifyContainer.classList.add('hidden');
        if (expandArrow) expandArrow.classList.remove('rotate-180');

        if (trackTitle) trackTitle.textContent = 'CHILLSYNTH // NIGHTRIDE FM';
        
        if (bgAudio && !bgAudio.paused) {
          if (trackStatus) {
            trackStatus.textContent = 'ON AIR // STREAM';
            trackStatus.style.color = '#00FF66';
          }
          if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
          if (radioEq) radioEq.classList.add('is-playing');
        } else {
          if (trackStatus) {
            trackStatus.textContent = 'STACJA ZATRZYMANA';
            trackStatus.style.color = '#00F0FF';
          }
          if (playIcon) playIcon.setAttribute('data-lucide', 'play');
          if (radioEq) radioEq.classList.remove('is-playing');
        }
      } else if (source === 'spotify') {
        if (spotifyBtn) spotifyBtn.classList.add('active');
        if (streamBtn) streamBtn.classList.remove('active');
        if (spotifyContainer) spotifyContainer.classList.remove('hidden');
        if (expandArrow) expandArrow.classList.add('rotate-180');

        // Lazy-load Spotify iframe: przenieś data-src → src przy pierwszym użyciu
        const spotifyIframe = spotifyContainer?.querySelector('iframe[data-src]');
        if (spotifyIframe && !spotifyIframe.src) {
          spotifyIframe.src = spotifyIframe.getAttribute('data-src');
          spotifyIframe.removeAttribute('data-src');
        }

        // Wycisz stream w tle, gdy użytkownik wybiera Spotify
        if (bgAudio && !bgAudio.paused) {
          bgAudio.pause();
        }

        if (trackTitle) trackTitle.textContent = 'FLASH FM // SPOTIFY';
        if (trackStatus) {
          trackStatus.textContent = 'WYBIERZ UTWÓR Z PLAYLISTY';
          trackStatus.style.color = '#FF1F7D';
        }
        
        if (playIcon) playIcon.setAttribute('data-lucide', 'disc');
        if (radioEq) radioEq.classList.add('is-playing');
      }

      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    if (streamBtn) streamBtn.addEventListener('click', () => setSource('stream'));
    if (spotifyBtn) spotifyBtn.addEventListener('click', () => setSource('spotify'));

    const trackInfoClick = document.getElementById('radio-track-info-click');

    let playPromise = null;

    const updatePausedUi = () => {
      if (playIcon) playIcon.setAttribute('data-lucide', 'play');
      if (radioEq) radioEq.classList.remove('is-playing');
      if (trackStatus) {
        trackStatus.textContent = 'STACJA ZATRZYMANA';
        trackStatus.style.color = '#00F0FF';
      }
      if (typeof lucide !== 'undefined') lucide.createIcons({ root: playBtn?.parentElement || undefined });
    };

    // Uniwersalna funkcja Play / Pause
    const togglePlayback = () => {
      if (currentSource === 'stream') {
        if (bgAudio) {
          if (bgAudio.paused) {
            playPromise = bgAudio.play();
            playPromise.then(() => {
              playPromise = null;
              if (playIcon) playIcon.setAttribute('data-lucide', 'pause');
              if (radioEq) radioEq.classList.add('is-playing');
              if (trackStatus) {
                trackStatus.textContent = 'ON AIR // STREAM';
                trackStatus.style.color = '#00FF66';
              }
              if (typeof lucide !== 'undefined') lucide.createIcons({ root: playBtn?.parentElement || undefined });
            }).catch(err => {
              playPromise = null;
              if (err.name !== 'AbortError') {
                updatePausedUi();
              }
            });
          } else {
            if (playPromise) {
              playPromise.then(() => {
                bgAudio.pause();
                updatePausedUi();
              }).catch(() => {
                updatePausedUi();
              });
            } else {
              bgAudio.pause();
              updatePausedUi();
            }
          }
        }
      } else {
        // Dla Spotify przycisk rozwija/chowa widget
        if (spotifyContainer) spotifyContainer.classList.toggle('hidden');
        if (expandArrow) expandArrow.classList.toggle('rotate-180');
      }
    };

    // Podpięcie pod przycisk, equalizer i tekst informacyjny
    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayback();
      });
    }
    if (radioEq) {
      radioEq.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePlayback();
      });
    }
    if (trackInfoClick) {
      trackInfoClick.addEventListener('click', (e) => {
        if (e.target !== playBtn && !playBtn.contains(e.target)) {
          togglePlayback();
        }
      });
    }

    // Przycisk rozwijania / zwijania
    if (expandBtn) {
      expandBtn.addEventListener('click', () => {
        if (spotifyContainer) spotifyContainer.classList.toggle('hidden');
        if (expandArrow) expandArrow.classList.toggle('rotate-180');
      });
    }

    // Regulator głośności i wyciszanie
    const volumeSlider = document.getElementById('radio-volume-slider');
    const volumeVal = document.getElementById('radio-volume-val');
    const muteBtn = document.getElementById('radio-mute-btn');
    const volumeIcon = document.getElementById('radio-volume-icon');

    let prevVolume = 0.2;

    if (bgAudio) {
      bgAudio.volume = 0.2;
    }

    if (volumeSlider && bgAudio) {
      volumeSlider.value = 0.2;
      let _lastVolumeIconType = 'volume-2';
      volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        bgAudio.volume = val;
        if (val > 0) prevVolume = val;
        if (volumeVal) volumeVal.textContent = `${Math.round(val * 100)}%`;
        if (volumeIcon) {
          const iconType = val === 0 ? 'volume-x' : (val < 0.5 ? 'volume-1' : 'volume-2');
          if (iconType !== _lastVolumeIconType) {
            _lastVolumeIconType = iconType;
            volumeIcon.setAttribute('data-lucide', iconType);
            if (typeof lucide !== 'undefined' && muteBtn) lucide.createIcons({ root: muteBtn });
          }
        }
      });
    }

    if (muteBtn && bgAudio && volumeSlider) {
      muteBtn.addEventListener('click', () => {
        if (bgAudio.volume > 0) {
          prevVolume = bgAudio.volume;
          bgAudio.volume = 0;
          volumeSlider.value = 0;
          if (volumeVal) volumeVal.textContent = '0%';
          if (volumeIcon) volumeIcon.setAttribute('data-lucide', 'volume-x');
        } else {
          bgAudio.volume = prevVolume || 0.2;
          volumeSlider.value = bgAudio.volume;
          if (volumeVal) volumeVal.textContent = `${Math.round(bgAudio.volume * 100)}%`;
          if (volumeIcon) volumeIcon.setAttribute('data-lucide', 'volume-2');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: muteBtn });
      });
    }

    // Minimalizacja / rozwinięcie panelu radia
    const collapseBtn = document.getElementById('radio-collapse-btn');
    const miniBtn = document.getElementById('radio-minimize-btn');
    const fullPanel = document.getElementById('radio-full-panel');

    if (collapseBtn && miniBtn && fullPanel) {
      collapseBtn.addEventListener('click', () => {
        fullPanel.classList.add('hidden');
        miniBtn.classList.remove('hidden');
      });

      miniBtn.addEventListener('click', () => {
        miniBtn.classList.add('hidden');
        fullPanel.classList.remove('hidden');
      });
    }
  },

  /* ----------------------------------------------------------
     TOAST NOTIFICATIONS
     ---------------------------------------------------------- */

  /**
   * Wyświetl powiadomienie toast
   * @param {string} message - Treść wiadomości
   * @param {'success'|'error'|'info'} type - Typ powiadomienia
   * @param {number} duration - Czas wyświetlania (ms)
   */
  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
      success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
      warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-icon"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    const safeType = ['success', 'error', 'info', 'warning'].includes(type) ? type : 'info';
    const toast = document.createElement('div');
    toast.className = `toast ${safeType}`;
    toast.innerHTML = iconMap[safeType] || iconMap.info;

    const textSpan = document.createElement('span');
    textSpan.textContent = String(message || '');
    toast.appendChild(textSpan);

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  /* ----------------------------------------------------------
     MODAL KONTAKT & BIZNES (kontakt@virp.pl)
     ---------------------------------------------------------- */
  initContactModal() {
    const modal = document.getElementById('contact-modal');
    const closeBtn = document.getElementById('contact-modal-close-btn');
    const openBtns = [
      document.getElementById('nav-contact-btn'),
      document.getElementById('mobile-contact-btn'),
      document.getElementById('footer-contact-btn')
    ];

    if (!modal) return;

    const openModal = () => {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    const closeModal = () => {
      modal.classList.remove('open');
      const streamersPortal = document.getElementById('streamers-portal');
      const gta6Portal = document.getElementById('gta6-portal');
      const hasOpenPortal = (streamersPortal && !streamersPortal.classList.contains('hidden')) || 
                            (gta6Portal && !gta6Portal.classList.contains('hidden'));
      if (!hasOpenPortal) {
        document.body.style.overflow = '';
      }
    };

    openBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
    });

    // Kopiowanie adresu e-mail z anty-scrapingowym zabezpieczeniem
    const copyBtn = document.getElementById('contact-copy-email-btn');
    const emailDisplay = document.getElementById('contact-email-display');
    const copyLabel = document.getElementById('contact-copy-label');

    if (copyBtn && emailDisplay) {
      copyBtn.addEventListener('click', async () => {
        const user = emailDisplay.dataset.user || 'kontakt';
        const domain = emailDisplay.dataset.domain || 'virp.pl';
        const fullEmail = `${user}@${domain}`;

        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(fullEmail);
          } else {
            const ta = document.createElement('textarea');
            ta.value = fullEmail;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }

          VIRP.showToast(`Skopiowano adres e-mail (${fullEmail}) do schowka! 📋`, 'success');
          if (copyLabel) {
            const originalText = copyLabel.textContent;
            copyLabel.textContent = 'Skopiowano!';
            setTimeout(() => {
              copyLabel.textContent = originalText;
            }, 2000);
          }
        } catch (err) {
          VIRP.showToast(`Adres e-mail: ${fullEmail}`, 'info');
        }
      });
    }
  },

  /* ----------------------------------------------------------
     MODAL POLITYKI PRYWATNOŚCI
     ---------------------------------------------------------- */
  initPrivacyModal() {
    const modal = document.getElementById('privacy-modal');
    const closeBtn = document.getElementById('privacy-modal-close-btn');
    const okBtn = document.getElementById('privacy-modal-ok-btn');
    const openBtns = [
      document.getElementById('footer-privacy-btn'),
      document.getElementById('cookie-privacy-btn')
    ];

    if (!modal) return;

    const openModal = () => {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    const closeModal = () => {
      modal.classList.remove('open');
      const streamersPortal = document.getElementById('streamers-portal');
      const gta6Portal = document.getElementById('gta6-portal');
      const hasOpenPortal = (streamersPortal && !streamersPortal.classList.contains('hidden')) || 
                            (gta6Portal && !gta6Portal.classList.contains('hidden'));
      if (!hasOpenPortal) {
        document.body.style.overflow = '';
      }
    };

    openBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (okBtn) okBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
    });
  },

  /* ----------------------------------------------------------
     BANER ZGODY NA COOKIES I LOCAL STORAGE
     ---------------------------------------------------------- */
  initCookieConsent() {
    const banner = document.getElementById('cookie-banner');
    const acceptBtn = document.getElementById('cookie-accept-btn');
    const privacyBtn = document.getElementById('cookie-privacy-btn');
    const settingsBtn = document.getElementById('footer-cookie-settings-btn');

    if (!banner) return;

    const showBanner = () => {
      banner.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');
      banner.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    const hideBanner = () => {
      banner.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
      banner.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
    };

    // Sprawdź czy użytkownik już wyraził zgodę
    try {
      const consent = localStorage.getItem('virp_cookie_consent');
      if (!consent) {
        setTimeout(showBanner, 1200);
      }
    } catch (_) {
      setTimeout(showBanner, 1200);
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => {
        try {
          localStorage.setItem('virp_cookie_consent', 'true');
        } catch (_) {}
        hideBanner();
        VIRP.showToast('Ustawienia prywatności zostały zapisane.', 'info', 2500);
      });
    }

    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => {
        const privModal = document.getElementById('privacy-modal');
        if (privModal) {
          privModal.classList.add('open');
          document.body.style.overflow = 'hidden';
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      });
    }

    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        showBanner();
      });
    }
  }
};


/* ============================================================
   DOM Ready — inicjalizacja aplikacji
   ============================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    VIRP.init();
  });
} else {
  VIRP.init();
}
