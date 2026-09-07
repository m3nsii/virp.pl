/* ============================================================
   VIRP.pl — Modal / Add Server Module (modal.js)
   Formularz dodawania serwera z walidacją i Discord Webhook Proxy
   ============================================================ */

/**
 * @namespace AddServerModal
 * @description Moduł formularza dodawania serwera + integracja Discord Proxy
 */
const AddServerModal = {

  /**
   * URL pośrednika (Cloudflare Worker proxy) do Discord Webhooka.
   * NIGDY nie umieszczaj bezpośredniego adresu webhooka Discord tutaj!
   * Token webhooka musi być przechowywany po stronie serwera (Worker).
   * Worker sprawdza nagłówek Origin i przekazuje dane na Discord.
   */
  PROXY_URL: 'https://virp-proxy.chojmarcel.workers.dev/',

  /** Cooldown na submit (5 minut) */
  SUBMIT_COOLDOWN: 5 * 60 * 1000,

  /** Klucz localStorage dla cooldownu */
  COOLDOWN_KEY: 'virp_submit_cooldown',

  /** Maksymalna liczba tagów */
  MAX_TAGS: 5,

  /** Aktualne tagi */
  tags: [],

  /* ----------------------------------------------------------
     INICJALIZACJA
     ---------------------------------------------------------- */

  /**
   * Inicjalizacja modułu
   */
  init() {
    this.modal = document.getElementById('add-server-modal');
    this.form = document.getElementById('add-server-form');

    if (!this.modal || !this.form) return;

    this.bindEvents();
  },

  /* ----------------------------------------------------------
     EVENT LISTENERS
     ---------------------------------------------------------- */

  /**
   * Podpięcie event listenerów
   */
  bindEvents() {
    // Otwieranie modala
    const openBtns = [
      document.getElementById('nav-add-server-btn'),
      document.getElementById('mobile-add-server-btn')
    ];

    openBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', () => this.open());
    });

    // Zamykanie modala
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    // Zamknij kliknięciem na overlay
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Zamknij klawiszem Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('open')) {
        this.close();
      }
    });

    // Formularz — submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    // Licznik znaków opisu
    const descTextarea = document.getElementById('form-server-desc');
    const descCount = document.getElementById('form-desc-count');
    if (descTextarea && descCount) {
      descTextarea.addEventListener('input', () => {
        descCount.textContent = descTextarea.value.length;
      });
    }

    // Delegacja zdarzeń do usuwania tagów
    const tagsContainer = document.getElementById('form-tags-container');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tag-index]');
        if (btn) {
          const idx = parseInt(btn.dataset.tagIndex, 10);
          if (!isNaN(idx)) this.removeTag(idx);
        }
      });
    }

    // Tagi — obsługa
    this.initTagsInput();
  },

  /* ----------------------------------------------------------
     MODAL OPEN / CLOSE
     ---------------------------------------------------------- */

  /**
   * Otwarcie modala
   */
  open() {
    this.modal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Leniwe renderowanie Cloudflare Turnstile przy otwarciu okna
    if (typeof VIRP !== 'undefined' && typeof VIRP.renderTurnstile === 'function') {
      VIRP.renderTurnstile('turnstile-server-container');
    }

    // Focus na pierwszym polu
    setTimeout(() => {
      const firstInput = document.getElementById('form-server-name');
      if (firstInput) firstInput.focus();
    }, 300);
  },

  /**
   * Zamknięcie modala
   */
  close() {
    this.modal.classList.remove('open');
    document.body.style.overflow = '';
  },

  /* ----------------------------------------------------------
     TAGS INPUT
     ---------------------------------------------------------- */

  /**
   * Inicjalizacja pola tagów
   */
  initTagsInput() {
    const container = document.getElementById('form-tags-container');
    const input = document.getElementById('form-tags-input');
    if (!container || !input) return;

    // Focus na input po kliknięciu kontenera
    container.addEventListener('click', () => input.focus());

    // Dodawanie tagu po Enter
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const rawTag = input.value.trim();
        const tag = rawTag.replace(/[^\w\s\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gi, '').substring(0, 20).trim();
        
        if (tag && this.tags.length < this.MAX_TAGS && !this.tags.includes(tag)) {
          this.tags.push(tag);
          this.renderTags();
          input.value = '';
        }
      }

      // Usuwanie ostatniego tagu Backspace
      if (e.key === 'Backspace' && input.value === '' && this.tags.length > 0) {
        this.tags.pop();
        this.renderTags();
      }
    });
  },

  /**
   * Renderowanie tagów w kontenerze
   */
  renderTags() {
    const container = document.getElementById('form-tags-container');
    const input = document.getElementById('form-tags-input');
    if (!container) return;

    // Usuń stare tagi
    container.querySelectorAll('.form-tag').forEach(t => t.remove());

    // Dodaj nowe z sanityzacją
    this.tags.forEach((tag, i) => {
      const tagEl = document.createElement('span');
      tagEl.className = 'form-tag';
      tagEl.innerHTML = `
        ${typeof sanitize === 'function' ? sanitize(tag) : tag}
        <button type="button" data-tag-index="${i}" aria-label="Usuń tag">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      `;
      container.insertBefore(tagEl, input);
    });
  },

  /**
   * Usunięcie tagu
   * @param {number} index - Indeks tagu
   */
  removeTag(index) {
    this.tags.splice(index, 1);
    this.renderTags();
  },

  /* ----------------------------------------------------------
     WALIDACJA
     ---------------------------------------------------------- */

  /**
   * Walidacja formularza
   * @returns {boolean} Czy formularz jest poprawny
   */
  validate() {
    let isValid = true;

    // Przechwyć wpisany tag, jeśli użytkownik nie nacisnął Enter
    const tagInput = document.getElementById('form-tags-input');
    if (tagInput && tagInput.value.trim() && this.tags.length < this.MAX_TAGS) {
      const pendingTag = tagInput.value.trim().replace(/[^\w\s\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gi, '').substring(0, 20).trim();
      if (pendingTag && !this.tags.includes(pendingTag)) {
        this.tags.push(pendingTag);
        this.renderTags();
        tagInput.value = '';
      }
    }

    // Reset errors
    this.form.querySelectorAll('.form-error').forEach(el => {
      el.classList.add('hidden');
      el.textContent = '';
    });
    this.form.querySelectorAll('.error').forEach(el => {
      el.classList.remove('error');
    });

    // Nazwa serwera
    const name = document.getElementById('form-server-name');
    if (!name || !name.value.trim()) {
      this.showFieldError('server-name', 'Nazwa serwera jest wymagana');
      isValid = false;
    } else if (name.value.trim().length < 3) {
      this.showFieldError('server-name', 'Nazwa musi mieć minimum 3 znaki');
      isValid = false;
    }

    // Kategoria rozgrywki
    const category = document.getElementById('form-server-category');
    if (!category || !category.value) {
      this.showFieldError('server-category', 'Wybierz kategorię rozgrywki');
      isValid = false;
    }

    // Typ komunikacji
    const type = document.getElementById('form-server-type');
    if (!type || !type.value) {
      this.showFieldError('server-type', 'Wybierz typ komunikacji');
      isValid = false;
    }

    // Sloty
    const slots = document.getElementById('form-server-slots');
    if (!slots || !slots.value || parseInt(slots.value) < 1) {
      this.showFieldError('server-slots', 'Podaj poprawną liczbę slotów (min. 1)');
      isValid = false;
    }

    // Discord (wymagany URL)
    const discord = document.getElementById('form-server-discord');
    if (!discord || !discord.value.trim()) {
      this.showFieldError('server-discord', 'Link Discord jest wymagany');
      isValid = false;
    } else if (!this.isValidURL(discord.value.trim())) {
      this.showFieldError('server-discord', 'Podaj poprawny link Discord (https://...)');
      isValid = false;
    }

    // WWW (opcjonalne)
    const website = document.getElementById('form-server-website');
    if (website && website.value.trim() && !this.isValidURL(website.value.trim())) {
      this.showFieldError('server-website', 'Podaj poprawny adres strony WWW (https://...)');
      isValid = false;
    }

    // Banner (opcjonalne)
    const banner = document.getElementById('form-server-banner');
    if (banner && banner.value.trim() && !this.isValidURL(banner.value.trim())) {
      this.showFieldError('server-banner', 'Podaj poprawny link do obrazu (https://...)');
      isValid = false;
    }

    // Opis
    const desc = document.getElementById('form-server-desc');
    if (!desc || !desc.value.trim()) {
      this.showFieldError('server-desc', 'Opis serwera jest wymagany');
      isValid = false;
    } else if (desc.value.trim().length < 30) {
      this.showFieldError('server-desc', 'Opis musi mieć minimum 30 znaków');
      isValid = false;
    }

    return isValid;
  },

  /**
   * Wyświetlenie błędu pod polem
   * @param {string} fieldName - Nazwa pola (bez prefiksu "form-")
   * @param {string} message - Treść błędu
   */
  showFieldError(fieldName, message) {
    const errorEl = document.getElementById(`error-${fieldName}`);
    const inputEl = document.getElementById(`form-${fieldName}`);

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
    if (inputEl) {
      inputEl.classList.add('error');
    }
  },

  /**
   * Bezpieczna walidacja URL (wyłącznie protokoły http: i https:)
   * @param {string} str - String do walidacji
   * @returns {boolean}
   */
  isValidURL(str) {
    if (!str || typeof str !== 'string') return false;
    try {
      const parsed = new URL(str.trim());
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  isSubmitting: false,

  /* ----------------------------------------------------------
     SUBMIT & DISCORD PROXY
     ---------------------------------------------------------- */

  /**
   * Obsługa wysłania formularza
   */
  async handleSubmit() {
    if (this.isSubmitting) return;

    // Sprawdzenie Honeypot (Anty-bot)
    const hpField = document.getElementById('form-server-hp');
    if (hpField && hpField.value.trim() !== '') {
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Wystąpił błąd podczas wysyłania zgłoszenia.', 'error');
      }
      return;
    }

    // Sprawdź cooldown
    if (this.isOnCooldown()) {
      const remaining = this.getRemainingCooldown();
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast(`Poczekaj jeszcze ${remaining} przed kolejnym zgłoszeniem.`, 'info');
      }
      return;
    }

    // Walidacja
    if (!this.validate()) return;

    // Zbierz dane
    const hpValue = document.getElementById('form-server-hp')?.value?.trim() || '';
    const turnstileToken = document.querySelector('#add-server-form [name="cf-turnstile-response"]')?.value || '';

    const turnstileWidget = document.getElementById('turnstile-server-container');
    if (turnstileWidget && !turnstileToken) {
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Proszę potwierdzić weryfikację anty-bot (Cloudflare Turnstile).', 'warning');
      }
      return;
    }

    const serverData = {
      name: document.getElementById('form-server-name')?.value?.trim() || '',
      category: document.getElementById('form-server-category')?.value || 'roleplay',
      platform: document.getElementById('form-server-platform')?.value || 'fivem',
      type: document.getElementById('form-server-type')?.value || 'voice',
      whitelist: document.getElementById('form-server-wl')?.value === 'true',
      slots: parseInt(document.getElementById('form-server-slots')?.value, 10) || 0,
      discord: document.getElementById('form-server-discord')?.value?.trim() || '',
      website: document.getElementById('form-server-website')?.value?.trim() || '',
      directConnect: document.getElementById('form-server-direct')?.value?.trim() || '',
      description: document.getElementById('form-server-desc')?.value?.trim() || '',
      tags: [...this.tags],
      banner: document.getElementById('form-server-banner')?.value?.trim() || '',
      hp: hpValue,
      website_hp_check: hpValue,
      turnstileToken: turnstileToken,
      submittedAt: new Date().toISOString()
    };

    this.isSubmitting = true;

    // Zablokuj przycisk
    const submitBtn = document.getElementById('form-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
        </svg>
        Wysyłanie...
      `;
    }

    try {
      await this.sendToDiscord(serverData);

      // Ustaw cooldown
      try {
        localStorage.setItem(this.COOLDOWN_KEY, Date.now().toString());
      } catch (_) {}

      // Sukces
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Serwer został wysłany do weryfikacji! 🎉', 'success');
      }
      this.close();
      this.resetForm();

    } catch (error) {
      console.error('[AddServerModal] Błąd wysyłania:', error);
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Wystąpił błąd podczas wysyłania. Spróbuj ponownie.', 'error');
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <i data-lucide="send" class="w-4 h-4 mr-2"></i>
          Wyślij do Weryfikacji
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons({ root: submitBtn });
      }
      if (typeof VIRP !== 'undefined' && typeof VIRP.resetTurnstile === 'function') {
        VIRP.resetTurnstile('turnstile-server-container');
      }
    }
  },

  /**
   * Wysyłanie danych na Cloudflare Worker proxy (który przekazuje na Discord)
   * 
   * ARCHITEKTURA BEZPIECZEŃSTWA:
   * Przeglądarka → Cloudflare Worker (sprawdza Origin) → Discord Webhook
   * Token webhooka jest przechowywany TYLKO w zmiennych środowiskowych Workera.
   * 
   * @param {Object} data - Dane serwera
   */
  async sendToDiscord(data) {
    if (this.PROXY_URL === 'YOUR_PROXY_WORKER_URL') {
      // Demo mode — symulacja wysyłania w celach developerskich
      await new Promise(resolve => setTimeout(resolve, 800));
      return;
    }

    const payload = {
      name: data.name,
      category: data.category,
      platform: data.platform,
      type: data.type,
      whitelist: data.whitelist,
      slots: data.slots,
      discord: data.discord,
      website: data.website,
      directConnect: data.directConnect,
      description: data.description,
      tags: data.tags,
      banner: data.banner,
      hp: data.hp,
      website_hp_check: data.website_hp_check,
      turnstileToken: data.turnstileToken,
      submittedAt: data.submittedAt
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(this.PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        let errDetail = '';
        try {
          const errJson = await response.json();
          errDetail = errJson.error || errJson.message || '';
        } catch (_) {}
        throw new Error(`Proxy error ${response.status}${errDetail ? ': ' + errDetail : ''}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  },

  /* ----------------------------------------------------------
     COOLDOWN
     ---------------------------------------------------------- */

  /**
   * Sprawdź czy submit jest na cooldownie
   * @returns {boolean}
   */
  isOnCooldown() {
    try {
      const lastSubmit = localStorage.getItem(this.COOLDOWN_KEY);
      if (!lastSubmit) return false;

      const parsed = parseInt(lastSubmit, 10);
      if (isNaN(parsed)) {
        localStorage.removeItem(this.COOLDOWN_KEY);
        return false;
      }

      const elapsed = Date.now() - parsed;
      if (elapsed < 0 || elapsed >= this.SUBMIT_COOLDOWN) {
        localStorage.removeItem(this.COOLDOWN_KEY);
        return false;
      }

      return true;
    } catch (_) {
      return false;
    }
  },

  /**
   * Pobierz pozostały czas cooldownu (sformatowany)
   * @returns {string}
   */
  getRemainingCooldown() {
    try {
      const lastSubmit = localStorage.getItem(this.COOLDOWN_KEY);
      if (!lastSubmit) return '0s';

      const parsed = parseInt(lastSubmit, 10);
      if (isNaN(parsed)) {
        localStorage.removeItem(this.COOLDOWN_KEY);
        return '0s';
      }

      const elapsed = Date.now() - parsed;
      if (elapsed < 0) {
        localStorage.removeItem(this.COOLDOWN_KEY);
        return '0s';
      }

      const remaining = Math.max(0, this.SUBMIT_COOLDOWN - elapsed);

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);

      if (minutes > 0) return `${minutes}m ${seconds}s`;
      return `${seconds}s`;
    } catch (_) {
      return '0s';
    }
  },

  /* ----------------------------------------------------------
     RESET
     ---------------------------------------------------------- */

  /**
   * Reset formularza
   */
  resetForm() {
    this.form.reset();
    this.tags = [];
    this.renderTags();

    const descCount = document.getElementById('form-desc-count');
    if (descCount) descCount.textContent = '0';

    // Reset errors
    this.form.querySelectorAll('.form-error').forEach(el => {
      el.classList.add('hidden');
    });
    this.form.querySelectorAll('.error').forEach(el => {
      el.classList.remove('error');
    });
  }
};


/* ============================================================
   Inicjalizacja
   ============================================================ */
window.AddServerModal = AddServerModal;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    AddServerModal.init();
  });
} else {
  AddServerModal.init();
}
