/* ============================================================
   VIRP.pl — RP Toolkit Module (toolkit.js)
   Generator Postaci, Kody Radiowe, Kalkulator Ekonomii
   ============================================================ */

/**
 * @namespace RPToolkit
 * @description Moduł narzędzi gracza RP
 */
const RPToolkit = {

  /** Aktywny panel */
  activePanel: 'character',

  /** Aktywna zakładka kodów */
  activeCodesTab: '10codes',

  /* ----------------------------------------------------------
     INICJALIZACJA
     ---------------------------------------------------------- */

  init() {
    this.bindToolkitNav();
    this.initCharacterGenerator();
    this.initRadioCodes();
    this.initCalculator();
    this.initFooterToolkitLinks();
  },

  /* ----------------------------------------------------------
     NAWIGACJA PANELI TOOLKIT
     ---------------------------------------------------------- */

  /**
   * Obsługa przełączania paneli (karty nawigacyjne)
   */
  bindToolkitNav() {
    const toolkitCards = document.querySelectorAll('.toolkit-card[data-toolkit]');

    toolkitCards.forEach(card => {
      card.addEventListener('click', () => {
        const panelName = card.dataset.toolkit;
        this.switchPanel(panelName);
      });
    });
  },

  /**
   * Przełączenie aktywnego panelu
   * @param {string} panelName - Nazwa panelu (character|codes|calculator)
   */
  switchPanel(panelName) {
    this.activePanel = panelName;

    // Update nav cards
    document.querySelectorAll('.toolkit-card[data-toolkit]').forEach(card => {
      card.classList.toggle('active', card.dataset.toolkit === panelName);
    });

    // Update panels
    document.querySelectorAll('.toolkit-panel').forEach(panel => {
      panel.classList.remove('active');
    });

    const targetPanel = document.getElementById(`panel-${panelName}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    // Reinitialize Lucide icons for new panel
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  /**
   * Obsługa linków do toolkita z footera
   */
  initFooterToolkitLinks() {
    document.querySelectorAll('[data-toolkit-link]').forEach(link => {
      link.addEventListener('click', (e) => {
        const panelName = link.dataset.toolkitLink;
        // Daj czas na scroll, potem przełącz panel
        setTimeout(() => this.switchPanel(panelName), 500);
      });
    });
  },

  /* ===========================================================
     1. GENERATOR KARTY POSTACI & DOWÓD ID LEONIDA
     =========================================================== */

  /**
   * Inicjalizacja generatora postaci
   */
  initCharacterGenerator() {
    const generateBtn = document.getElementById('char-generate-btn');
    const clearBtn = document.getElementById('char-clear-btn');
    const copyBtn = document.getElementById('char-copy-btn');
    const copyDiscordBtn = document.getElementById('char-copy-discord-btn');
    const exportPngBtn = document.getElementById('char-export-png-btn');
    const exportPdfBtn = document.getElementById('char-export-pdf-btn');
    const exportTxtBtn = document.getElementById('char-export-btn');
    const randomBtn = document.getElementById('char-random-btn');

    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateCharacterCard());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearCharacterForm());
    }

    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyCharacterToClipboard());
    }

    if (copyDiscordBtn) {
      copyDiscordBtn.addEventListener('click', () => this.copyCharacterForDiscord());
    }

    if (exportPngBtn) {
      exportPngBtn.addEventListener('click', () => this.exportIdCardToPng());
    }

    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => this.exportCharacterToPdf());
    }

    if (exportTxtBtn) {
      exportTxtBtn.addEventListener('click', () => this.exportCharacterToTxt());
    }

    if (randomBtn) {
      randomBtn.addEventListener('click', () => this.randomizeCharacter());
    }

    // Obsługa kliknięć w gotowe archetypy
    document.querySelectorAll('.char-preset-btn[data-archetype]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.char-preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.applyArchetype(btn.dataset.archetype);
      });
    });

    // Początkowy render karty canvas
    this.renderDefaultIdCanvas();
  },

  /**
   * Zestawy archetypów postaci (1-Click Presets)
   */
  archetypes: {
    cop: {
      name: 'James "Mack" Sterling',
      age: 34,
      gender: 'Mężczyzna',
      origin: 'Vice City, Leonida',
      job: 'Zastępca Szeryfa / LSPD',
      avatar: 'police',
      traits: 'Opanowany, lojalny, spostrzegawczy, wyszkolenie taktyczne',
      flaws: 'Zbyt ufny w procedury, pamiętliwy, wypalenie zawodowe, bezsenność',
      phobias: 'Klaustrofobia (uraz po uwięzieniu w radiowozie), niechęć do walki wręcz',
      features: 'Krótka fryzura wojskowa, blizna na brodzie, zawsze wyprasowany mundur',
      backstory: 'Wychowany w robotniczej dzielnicy Vice City. Po 6 latach służby wojskowej wrócił do rodzinnego stanu Leonida, by wstąpić do departamentu szeryfa. Pragnie przywrócić porządek na ulicach opanowanych przez nowe kartele.',
      goals: 'Awansować na stopień sierżanta i oczyścić dzielnicę portową z przemytu broni.'
    },
    medic: {
      name: 'Dr. Elena Rossi',
      age: 29,
      gender: 'Kobieta',
      origin: 'Włochy / Vice City',
      job: 'Lekarz Rezydent / Paramedyk EMS',
      avatar: 'medic',
      traits: 'Empatyczna, odporna na stres, precyzyjna, doskonała pamięć',
      flaws: 'Pracoholiczka, trudności z odmawianiem pomocy, impulsywność w sytuacjach krytycznych',
      phobias: 'Lęk przed ogniem (trauma z dzieciństwa), bezradność wobec śmierci pacjenta',
      features: 'Włosy spięte w kok, stetoskop na szyi, drobny tatuaż eskulapa na nadgarstku',
      backstory: 'Ukończyła studia medyczne w Mediolanie i przeniosła się do Vice General Hospital. W realiach brutalnego miasta często musi podejmować decyzje na granicy życia i śmierci pod presją czasu.',
      goals: 'Zbudować nowoczesny oddział szybkiego reagowania ratownictwa medycznego.'
    },
    mechanic: {
      name: 'Dawid "Nitro" Kowalski',
      age: 26,
      gender: 'Mężczyzna',
      origin: 'Polska (Warszawa) / Ocean Beach',
      job: 'Główny Tuner / Właściciel Warsztatu',
      avatar: 'street',
      traits: 'Geniusz mechaniczny, wyczucie trajektorii, kreatywność, determinacja',
      flaws: 'Nałogowy hazardzista wyścigowy, lekkomyślność finansowa, porywczy charakter',
      phobias: 'Chorobliwy lęk przed aresztowaniem i konfiskatą projektów aut',
      features: 'Ręce wiecznie ubrudzone smarem, czapka z daszkiem snapback, tatuaż silnika V8 na przedramieniu',
      backstory: 'Przyjechał z Polski za marzeniem budowy najszybszych aut w Vice City. Zaczynał od wymiany klocków w szopie, a dziś składa japońskie potwory biturbo do nielegalnych wyścigów ulicznych.',
      goals: 'Wygrać puchar Vice City Underground i otworzyć legalną hamownię.'
    },
    gang: {
      name: 'Mateo "El Mudo" Delgado',
      age: 31,
      gender: 'Mężczyzna',
      origin: 'Meksyk / Little Haiti',
      job: 'Egzekutor Kartelu / Handlarz',
      avatar: 'crime',
      traits: 'Bezwzględnie lojalny rodzinie, cichy, mistrz kamuflażu, opanowanie',
      flaws: 'Chciwość, brak empatii dla obcych, paranoja przed zdradą, nieufność',
      phobias: 'Paniczny lęk przed wodą (nie potrafi pływać), lęk przed psami policyjnymi',
      features: 'Skórzana kurtka, głęboka blizna od maczety na lewym policzku, sygnet rodowy',
      backstory: 'Dorastał na ulicach pełnych przemocy. Po rozbiciu jego grupy w Meksyku uciekł motorówką do Leonidy, gdzie szybko znalazł zatrudnienie w strukturach lokalnego syndykatu przemytniczego.',
      goals: 'Przejąć kontrolę nad magazynami w porcie i zdobyć szacunek bossów.'
    },
    business: {
      name: 'Alexander Vance',
      age: 42,
      gender: 'Mężczyzna',
      origin: 'Nowy Jork / Downtown Vice',
      job: 'Inwestor Nieruchomości / Makler',
      avatar: 'suit',
      traits: 'Wybitna retoryka, charyzma, zmysł analityczny, wysoka kultura',
      flaws: 'Egoizm, materializm, bezwzględność biznesowa, uzależnienie od drogich cygar',
      phobias: 'Lęk przed bankructwem i utratą statusu społecznego, astma wysiłkowa',
      features: 'Szyty na miarę garnitur w prążki, złoty zegarek Rolex, nienaganny uśmiech',
      backstory: 'Zbił fortunę na giełdzie Wall Street, po czym przeniósł swoje aktywa do rozwijającego się rynku nieruchomości w Vice City. Kupuje kluby nocne i mariny, balansując na granicy prawa.',
      goals: 'Wykupić wieżowiec w Downtown i sfinansować własną partię polityczną.'
    },
    driver: {
      name: 'Kamil "Ghost" Szymański',
      age: 27,
      gender: 'Mężczyzna',
      origin: 'Polska / Starfish Island',
      job: 'Kierowca Ucieczkowy (Getaway Driver)',
      avatar: 'racer',
      traits: 'Genialny refleks, znajomość każdego skrótu w mieście, zimna krew w pościgach',
      flaws: 'Uzależnienie od adrenaliny, skłonność do brawury, unika stałych relacji',
      phobias: 'Lęk wysokości, nie znosi małych zamkniętych pomieszczeń bez okien',
      features: 'Rękawiczki wyścigowe bez palców, sportowa bluza, zawsze nosi okulary przeciwsłoneczne',
      backstory: 'Były kierowca rajdowy w Europie, który po zawieszeniu licencji zaoferował swoje umiejętności półświatkowi. W Vice City wynajmuje się ekipom napadowym jako gwarancja bezpiecznego odwrotu.',
      goals: 'Zgromadzić 500 000 $ na zakup i modyfikację legendarnego klasyka z 1988 roku.'
    }
  },

  /**
   * Zastosowanie wybranego archetypu
   */
  applyArchetype(key) {
    const data = this.archetypes[key];
    if (!data) return;

    this.setFormValues(data);
    this.generateCharacterCard();
    VIRP.showToast(`Wczytano archetyp: ${data.job} 🎭`, 'success');
  },

  /**
   * Losowanie zbalansowanej postaci (Generator 1-Click)
   */
  randomizeCharacter() {
    const firstNamesM = ['Lucas', 'Diego', 'Mateo', 'Kamil', 'Marcus', 'Viktor', 'Dominic', 'Gabriel', 'Adrian', 'Leo'];
    const firstNamesF = ['Elena', 'Mia', 'Sofia', 'Karolina', 'Valeria', 'Natasza', 'Carmen', 'Olivia', 'Maya'];
    const lastNames = ['Vance', 'Rossi', 'Delgado', 'Kowalski', 'Sterling', 'Moretti', 'Novak', 'Santoro', 'Castillo', 'Bautista'];
    
    const isFemale = Math.random() > 0.6;
    const firstName = isFemale ? firstNamesF[Math.floor(Math.random() * firstNamesF.length)] : firstNamesM[Math.floor(Math.random() * firstNamesM.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const age = Math.floor(Math.random() * 32) + 20;

    const origins = ['Vice City, Leonida', 'Liberty City', 'Los Santos', 'Polska (Kraków)', 'Włochy (Neapol)', 'Meksyk (Tijuana)', 'Kolumbia (Medellín)', 'Kuba (Hawana)'];
    
    const jobs = [
      { job: 'Funkcjonariusz Policji', avatar: 'police' },
      { job: 'Ratownik Medyczny / EMS', avatar: 'medic' },
      { job: 'Mechanik Samochodowy', avatar: 'street' },
      { job: 'Kierowca Uliczny / Drifter', avatar: 'racer' },
      { job: 'Makler Nieruchomości', avatar: 'suit' },
      { job: 'Barman / Właściciel Pubu', avatar: 'street' },
      { job: 'Egzekutor Długów', avatar: 'crime' }
    ];
    const pickedJob = jobs[Math.floor(Math.random() * jobs.length)];

    const traitsPool = [
      'Opanowany, lojalny, szybki refleks',
      'Charyzmatyczny, wygadany, spostrzegawczy',
      'Analityczny umysł, precyzja, odporność na stres',
      'Zdeterminowany, wierny przyjaciołom, pracowity',
      'Kreatywny, łatwo nawiązuje kontakty, czujny'
    ];

    const flawsPool = [
      'Hazardzista, impulsywność w gniewie, chciwość',
      'Paranoik, nie ufa nikomu, pamiętliwy',
      'Lekkomyślność finansowa, porywczy charakter',
      'Trudność z panowaniem nad emocjami, upór',
      'Uzależnienie od kofeiny/nikotyny, cynizm'
    ];

    const phobiasPool = [
      'Lęk wysokości, astma wysiłkowa',
      'Lęk przed głęboką wodą (nie umie pływać)',
      'Klaustrofobia, blizna po postrzale w barku',
      'Paniczny lęk przed psami bojowymi',
      'Problem z zaufaniem po zdradzie partnera'
    ];

    const featuresPool = [
      'Blizna nad lewym łukiem brwiowym, tatuaż na szyi',
      'Zawsze nosi ciemne okulary i skórzaną kurtkę',
      'Lekki południowy akcent, nienaganny ubiór',
      'Tatuaż tribala na przedramieniu, srebrny łańcuszek',
      'Sportowy zegarek, lekko utyka przy gwałtownym biegu'
    ];

    const randomData = {
      name: `${firstName} ${lastName}`,
      age: age,
      gender: isFemale ? 'Kobieta' : 'Mężczyzna',
      origin: origins[Math.floor(Math.random() * origins.length)],
      job: pickedJob.job,
      avatar: pickedJob.avatar,
      traits: traitsPool[Math.floor(Math.random() * traitsPool.length)],
      flaws: flawsPool[Math.floor(Math.random() * flawsPool.length)],
      phobias: phobiasPool[Math.floor(Math.random() * phobiasPool.length)],
      features: featuresPool[Math.floor(Math.random() * featuresPool.length)],
      backstory: `Przybył(a) do Vice City w poszukiwaniu nowego początku. Doświadczenia z przeszłości nauczyły postać polegać na sobie, jednak w realiach stanu Leonida musi wypracować nową reputację.`,
      goals: `Zbudować stabilną pozycję w mieście, zdobyć zaufanie kluczowych ludzi i osiągnąć niezależność finansową.`
    };

    this.setFormValues(randomData);
    this.generateCharacterCard();
    VIRP.showToast(`Wylosowano postać: ${randomData.name} 🎲`, 'success');
  },

  /**
   * Pomocnicza metoda ustawiania wartości formularza
   */
  setFormValues(data) {
    const setValue = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val !== undefined ? val : '';
    };

    setValue('char-name', data.name);
    setValue('char-age', data.age);
    setValue('char-gender', data.gender);
    setValue('char-origin', data.origin);
    setValue('char-job', data.job);
    setValue('char-avatar-type', data.avatar || 'street');
    setValue('char-traits', data.traits);
    setValue('char-flaws', data.flaws);
    setValue('char-phobias', data.phobias);
    setValue('char-features', data.features);
    setValue('char-backstory', data.backstory);
    setValue('char-goals', data.goals);
  },

  /**
   * Generowanie sformatowanej karty postaci + render Canvas ID
   */
  generateCharacterCard() {
    const name = document.getElementById('char-name')?.value.trim();
    const age = document.getElementById('char-age')?.value || '28';
    const gender = document.getElementById('char-gender')?.value || 'Mężczyzna';
    const origin = document.getElementById('char-origin')?.value.trim() || 'Vice City, Leonida';
    const job = document.getElementById('char-job')?.value.trim() || 'Obywatel';
    const avatarType = document.getElementById('char-avatar-type')?.value || 'street';
    const traits = document.getElementById('char-traits')?.value.trim() || '';
    const flaws = document.getElementById('char-flaws')?.value.trim() || '';
    const phobias = document.getElementById('char-phobias')?.value.trim() || '';
    const features = document.getElementById('char-features')?.value.trim() || '';
    const backstory = document.getElementById('char-backstory')?.value.trim();
    const goals = document.getElementById('char-goals')?.value.trim() || '';

    // Walidacja minimalna
    if (!name) {
      VIRP.showToast('Podaj imię i nazwisko postaci!', 'error');
      document.getElementById('char-name')?.focus();
      return;
    }

    if (!backstory) {
      VIRP.showToast('Podaj historię postaci (Backstory)!', 'error');
      document.getElementById('char-backstory')?.focus();
      return;
    }

    const charData = {
      name, age, gender, origin, job, avatarType, traits, flaws, phobias, features, backstory, goals
    };
    this._currentCharData = charData;

    // 1. Formatowanie czystego tekstu podania
    const divider = '═'.repeat(55);
    const thinDivider = '─'.repeat(55);

    let card = '';
    card += `${divider}\n`;
    card += `   KARTA POSTACI — PODANIE WHITELIST // VIRP.PL\n`;
    card += `   VIRP.PL  |  STAN: LEONIDA (VICE CITY)\n`;
    card += `${divider}\n\n`;

    card += `▸ DANE PERSONALNE:\n`;
    card += `  • Imię i Nazwisko:   ${name}\n`;
    card += `  • Wiek / Płeć:       ${age} lat  |  ${gender}\n`;
    card += `  • Pochodzenie:       ${origin}\n`;
    card += `  • Zawód / Rola:      ${job}\n\n`;

    card += `${thinDivider}\n`;
    card += `▸ ZBALANSOWANIE I PSYCHIKA POSTACI (WYMÓG WL):\n`;
    card += `${thinDivider}\n`;
    if (traits) card += `  • Zalety / Mocne strony: ${traits}\n`;
    if (flaws) card += `  • Wady charakteru:       ${flaws}\n`;
    if (phobias) card += `  • Fobie / Ograniczenia:  ${phobias}\n`;
    if (features) card += `  • Znaki szczególne:      ${features}\n\n`;

    card += `${thinDivider}\n`;
    card += `▸ HISTORIA POSTACI (BACKSTORY):\n`;
    card += `${thinDivider}\n`;
    card += `${backstory}\n\n`;

    if (goals) {
      card += `${thinDivider}\n`;
      card += `▸ CELE I MOTYWACJE W MIEŚCIE:\n`;
      card += `${thinDivider}\n`;
      card += `${goals}\n\n`;
    }

    card += `${divider}\n`;
    card += `   Wygenerowano na VIRP.pl — ${new Date().toLocaleDateString('pl-PL')}\n`;
    card += `   Oficjalny Hub Społeczności GTA 6 & Roleplay\n`;
    card += `${divider}`;

    // Wyświetl tekst
    const output = document.getElementById('char-output');
    if (output) {
      output.textContent = card;
      output.style.color = 'var(--text-primary)';
    }

    this._lastGeneratedCard = card;

    // 2. Render graficznej karty ID na Canvas
    this.renderIdCardCanvas(charData);

    VIRP.showToast('Karta postaci oraz Dowód ID wygenerowane! ✨', 'success');
  },

  /**
   * Silnik renderowania Graficznej Karty ID / Prawa Jazdy Stanu Leonida (HTML5 Canvas)
   */
  renderIdCardCanvas(data) {
    const canvas = document.getElementById('char-id-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;  // 856
    const h = canvas.height; // 540

    // 1. Tło i Gradient Cyberpunk Hologram
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#060913');
    bgGrad.addColorStop(0.5, '#0E1528');
    bgGrad.addColorStop(1, '#1A0B22');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Siatka scanlines i hologram
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 3. Ozdobne obramowanie karty HUD
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.strokeStyle = 'rgba(255, 31, 125, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // 4. Górny baner DMV Stanu Leonida
    ctx.fillStyle = 'rgba(13, 17, 29, 0.95)';
    ctx.fillRect(16, 16, w - 32, 70);

    // Linia neonowa pod banerem
    const lineGrad = ctx.createLinearGradient(16, 86, w - 16, 86);
    lineGrad.addColorStop(0, '#FF1F7D');
    lineGrad.addColorStop(0.5, '#00F0FF');
    lineGrad.addColorStop(1, '#FF9E00');
    ctx.fillStyle = lineGrad;
    ctx.fillRect(16, 84, w - 32, 3);

    // Teksty w banerze
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px "Cabinet Grotesk", "Segoe UI", sans-serif';
    ctx.fillText('STATE OF LEONIDA', 36, 48);

    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('DEPT. OF HIGHWAY SAFETY & MOTOR VEHICLES // DRIVER LICENSE', 36, 68);

    // ZNAK WODNY VIRP.PL W PRAWYM GÓRNYM ROGU (Wymóg!)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FF1F7D';
    ctx.font = 'bold 24px "Cabinet Grotesk", "Segoe UI", sans-serif';
    ctx.fillText('VIRP.PL', w - 36, 48);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('VERIFIED CITIZEN ID', w - 36, 68);
    ctx.textAlign = 'left';

    // 5. Pole zdjęcia / Awataru (Avatar Box)
    const photoX = 40;
    const photoY = 115;
    const photoW = 190;
    const photoH = 240;

    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(photoX, photoY, photoW, photoH);
    ctx.strokeStyle = '#00F0FF';
    ctx.lineWidth = 2;
    ctx.strokeRect(photoX, photoY, photoW, photoH);

    // Rysowanie awataru sylwetki
    this.drawAvatarSilhouette(ctx, data.avatarType || 'street', photoX, photoY, photoW, photoH);

    // Nakładka hologramu na zdjęcie
    ctx.fillStyle = 'rgba(0, 240, 255, 0.1)';
    ctx.fillRect(photoX, photoY + photoH - 35, photoW, 35);
    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('OFFICIAL IDENTITY', photoX + photoW / 2, photoY + photoH - 14);
    ctx.textAlign = 'left';

    // 6. Główne dane personalne (Środek i Prawa strona)
    const infoX = 260;
    let currY = 135;

    // Imię i Nazwisko
    ctx.fillStyle = '#64748B';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('FULL NAME / NAZWISKO & IMIĘ:', infoX, currY);
    currY += 26;
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px "Cabinet Grotesk", "Segoe UI", sans-serif';
    ctx.fillText(data.name.toUpperCase(), infoX, currY, w - infoX - 40);
    currY += 34;

    // Wiersz 1: Wiek, Płeć, Pochodzenie
    ctx.fillStyle = '#64748B';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('AGE / WIEK:', infoX, currY);
    ctx.fillText('SEX / PŁEĆ:', infoX + 130, currY);
    ctx.fillText('ORIGIN / POCHODZENIE:', infoX + 260, currY);
    currY += 20;

    ctx.fillStyle = '#00F0FF';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText(`${data.age} YRS`, infoX, currY);
    ctx.fillText(data.gender.substring(0, 1).toUpperCase(), infoX + 130, currY);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(data.origin.substring(0, 24), infoX + 260, currY);
    currY += 32;

    // Wiersz 2: Rola / Zawód
    ctx.fillStyle = '#64748B';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('CLASS / ZAWÓD & ROLA:', infoX, currY);
    currY += 20;
    ctx.fillStyle = '#FF1F7D';
    ctx.font = 'bold 18px "Cabinet Grotesk", "Segoe UI", sans-serif';
    ctx.fillText(data.job.toUpperCase(), infoX, currY, w - infoX - 40);
    currY += 32;

    // Wiersz 3: Licencja i Data
    ctx.fillStyle = '#64748B';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText('LIC NO / NUMER:', infoX, currY);
    ctx.fillText('EXP / WAŻNOŚĆ:', infoX + 190, currY);
    ctx.fillText('STATUS:', infoX + 340, currY);
    currY += 20;

    const licHash = (Math.abs(this.hashCode(data.name)) % 89999 + 10000).toString(16).toUpperCase();
    ctx.fillStyle = '#FF9E00';
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(`LEO-2026-${licHash}`, infoX, currY);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('2028-12-31', infoX + 190, currY);
    ctx.fillStyle = '#00FF66';
    ctx.fillText('WL VERIFIED', infoX + 340, currY);

    // 7. Podpis kaligraficzny postaci
    const sigY = 430;
    ctx.fillStyle = '#64748B';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('HOLDER SIGNATURE / PODPIS POSIADACZA:', 40, sigY - 10);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, sigY + 30);
    ctx.lineTo(230, sigY + 30);
    ctx.stroke();

    ctx.fillStyle = '#00F0FF';
    ctx.font = 'italic 24px "Brush Script MT", "Segoe Script", cursive';
    ctx.fillText(data.name, 50, sigY + 22, 175);

    // 8. Kod kreskowy / Pasek na dole
    const barX = 260;
    const barY = 410;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (let i = 0; i < 320; i += 6) {
      const barW = (i % 12 === 0) ? 3 : (i % 8 === 0 ? 2 : 1);
      ctx.fillRect(barX + i, barY, barW, 40);
    }

    // Pieczęć holograficzna w tle (Watermark)
    ctx.save();
    ctx.translate(w - 120, h - 120);
    ctx.rotate(-0.2);
    ctx.strokeStyle = 'rgba(255, 31, 125, 0.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(-60, -30, 120, 60);
    ctx.fillStyle = 'rgba(255, 31, 125, 0.18)';
    ctx.font = 'bold 16px "Cabinet Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VIRP.PL', 0, 0);
    ctx.font = 'bold 8px "JetBrains Mono", monospace';
    ctx.fillText('LEONIDA STATE SEAL', 0, 14);
    ctx.restore();
  },

  /**
   * Domyślny pusty stan karty ID
   */
  renderDefaultIdCanvas() {
    this.renderIdCardCanvas({
      name: 'MARCO VALENTINO',
      age: 28,
      gender: 'Mężczyzna',
      origin: 'Vice City, Leonida',
      job: 'Obywatel / Kierowca',
      avatarType: 'street'
    });
  },

  /**
   * Rysowanie ikony sylwetki awataru w canvas
   */
  drawAvatarSilhouette(ctx, type, x, y, w, h) {
    const cx = x + w / 2;
    const cy = y + h / 2 - 10;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // Tło sylwetki
    ctx.fillStyle = '#141A29';
    ctx.fillRect(x, y, w, h);

    // Głowa
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(cx, cy - 30, 36, 0, Math.PI * 2);
    ctx.fill();

    // Tułów
    ctx.beginPath();
    ctx.arc(cx, cy + 85, 75, Math.PI, 0, false);
    ctx.fill();

    // Akcent kolorystyczny wg roli
    ctx.fillStyle = '#00F0FF';
    if (type === 'police') ctx.fillStyle = '#3B82F6';
    if (type === 'medic') ctx.fillStyle = '#EF4444';
    if (type === 'crime') ctx.fillStyle = '#A855F7';
    if (type === 'suit') ctx.fillStyle = '#F59E0B';
    if (type === 'racer') ctx.fillStyle = '#FF1F7D';

    ctx.fillRect(cx - 15, cy + 30, 30, 10);

    ctx.restore();
  },

  /**
   * Pobieranie wygenerowanej karty ID w formacie PNG
   */
  exportIdCardToPng() {
    if (!this._currentCharData || !this._currentCharData.name) {
      const nameInput = document.getElementById('char-name')?.value.trim();
      const backstoryInput = document.getElementById('char-backstory')?.value.trim();
      if (nameInput && backstoryInput) {
        this.generateCharacterCard();
      } else {
        VIRP.showToast('Wypełnij formularz i wygeneruj kartę postaci!', 'info');
        return;
      }
    }

    const canvas = document.getElementById('char-id-canvas');
    if (!canvas) return;

    const charName = document.getElementById('char-name')?.value.trim() || 'postac';
    const safeName = charName.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]/g, '').replace(/\s+/g, '_');
    const filename = `karta_id_leonida_${safeName}.png`;

    try {
      const link = document.createElement('a');
      link.download = filename;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      VIRP.showToast(`Pobrano kartę ID: ${filename} 🖼️`, 'success');
    } catch (e) {
      console.warn('[RPToolkit] Błąd eksportu canvas ID:', e);
      VIRP.showToast('Nie udało się wyeksportować karty ID.', 'error');
    }
  },

  /**
   * Eksport kompletnego podania do dokumentu PDF
   */
  exportCharacterToPdf() {
    if (!this._currentCharData || !this._currentCharData.name) {
      const nameInput = document.getElementById('char-name')?.value.trim();
      const backstoryInput = document.getElementById('char-backstory')?.value.trim();
      if (nameInput && backstoryInput) {
        this.generateCharacterCard();
      } else {
        VIRP.showToast('Wypełnij imię i historię postaci!', 'info');
        return;
      }
    }

    const data = this._currentCharData;
    const canvas = document.getElementById('char-id-canvas');

    const cleanText = (str) => {
      if (!str) return '';
      const map = {
        'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
        'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
      };
      return String(str).replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, m => map[m] || m);
    };

    try {
      const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
      if (jsPDFConstructor) {
        const doc = new jsPDFConstructor({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        // 1. Tło i Nagłówek
        doc.setFillColor(11, 15, 25);
        doc.rect(0, 0, 210, 297, 'F');

        // Baner nagłówka
        doc.setFillColor(14, 21, 40);
        doc.rect(10, 10, 190, 22, 'F');
        doc.setDrawColor(0, 240, 255);
        doc.setLineWidth(0.5);
        doc.rect(10, 10, 190, 22, 'S');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.text('PODANIE NA WHITELIST // STAN LEONIDA', 15, 23);

        // Logo w prawym rogu
        doc.setTextColor(255, 31, 125);
        doc.setFontSize(15);
        doc.text('VIRP.PL', 190, 23, { align: 'right' });

        // 2. Osadzenie Karty ID Canvas w PDF
        if (canvas) {
          const imgData = canvas.toDataURL('image/png');
          doc.addImage(imgData, 'PNG', 15, 36, 180, 113);
        }

        // 3. Treść podania i zbalansowanie postaci
        let y = 158;

        doc.setTextColor(0, 240, 255);
        doc.setFontSize(11);
        doc.text('1. DANE ORAZ ZBALANSOWANIE PSYCHIKI POSTACI', 15, y);
        y += 7;

        doc.setTextColor(200, 210, 230);
        doc.setFontSize(8.5);
        doc.text(`Imie i Nazwisko: ${cleanText(data.name)} | Wiek: ${data.age} lat | Plec: ${cleanText(data.gender)} | Pochodzenie: ${cleanText(data.origin)}`, 15, y);
        y += 5.5;
        doc.text(`Rola / Zawod: ${cleanText(data.job)}`, 15, y);
        y += 5.5;
        if (data.traits) { doc.text(`Zalety / Mocne strony: ${cleanText(data.traits)}`, 15, y); y += 5.5; }
        if (data.flaws) { doc.text(`Wady charakteru: ${cleanText(data.flaws)}`, 15, y); y += 5.5; }
        if (data.phobias) { doc.text(`Fobie i ograniczenia: ${cleanText(data.phobias)}`, 15, y); y += 5.5; }
        if (data.features) { doc.text(`Znaki szczegolne: ${cleanText(data.features)}`, 15, y); y += 7; }

        doc.setTextColor(0, 240, 255);
        doc.setFontSize(11);
        doc.text('2. HISTORIA POSTACI (BACKSTORY)', 15, y);
        y += 7;

        doc.setTextColor(220, 225, 235);
        doc.setFontSize(8);
        const splitBackstory = doc.splitTextToSize(cleanText(data.backstory) || '', 180);
        
        if (y + (splitBackstory.length * 4.2) > 275) {
          doc.addPage();
          doc.setFillColor(11, 15, 25);
          doc.rect(0, 0, 210, 297, 'F');
          y = 20;
        }

        doc.text(splitBackstory, 15, y);
        y += (splitBackstory.length * 4.2) + 6;

        if (data.goals) {
          if (y > 255) {
            doc.addPage();
            doc.setFillColor(11, 15, 25);
            doc.rect(0, 0, 210, 297, 'F');
            y = 20;
          }
          doc.setTextColor(0, 240, 255);
          doc.setFontSize(11);
          doc.text('3. CELE I MOTYWACJE W MIESCIE', 15, y);
          y += 7;
          doc.setTextColor(220, 225, 235);
          doc.setFontSize(8);
          const splitGoals = doc.splitTextToSize(cleanText(data.goals) || '', 180);
          doc.text(splitGoals, 15, y);
        }

        // Stopka
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7.5);
        doc.text(`Wygenerowano na VIRP.pl | VIRP.PL | Data: ${new Date().toLocaleDateString('pl-PL')}`, 105, 290, { align: 'center' });

        const safeName = cleanText(data.name).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        doc.save(`podanie_whitelist_${safeName}.pdf`);
        VIRP.showToast('Pobrano podanie w formacie PDF! 📄', 'success');
        return;
      }
    } catch (e) {
      console.warn('[RPToolkit] jsPDF generation error:', e);
    }

    // Fallback: Eksport txt
    if (typeof VIRP !== 'undefined' && VIRP.showToast) {
      VIRP.showToast('Biblioteka PDF niedostępna w tej przeglądarce. Pobieram podanie w formacie TXT... 📄', 'info');
    }
    this.exportCharacterToTxt();
  },

  /**
   * Kopiowanie sformatowanego podania pod Discord Markdown
   */
  async copyCharacterForDiscord() {
    if (!this._currentCharData || !this._currentCharData.name) {
      const nameInput = document.getElementById('char-name')?.value.trim();
      const backstoryInput = document.getElementById('char-backstory')?.value.trim();
      if (nameInput && backstoryInput) {
        this.generateCharacterCard();
      } else {
        if (typeof VIRP !== 'undefined' && VIRP.showToast) {
          VIRP.showToast('Najpierw wygeneruj kartę postaci!', 'info');
        }
        return;
      }
    }

    const d = this._currentCharData;
    const safeBackstory = (d.backstory || '').replace(/```/g, "'''");
    const safeGoals = (d.goals || '').replace(/```/g, "'''");

    let md = '';
    md += `>>> **═════════════════════════════════════════════**\n`;
    md += `**📋 PODANIE NA WHITELIST // VIRP.PL**\n`;
    md += `*Stan Leonida — Vice City 2026*\n`;
    md += `**═════════════════════════════════════════════**\n\n`;

    md += `**▸ DANE PERSONALNE:**\n`;
    md += `> **Imię i Nazwisko:** \`${d.name}\`\n`;
    md += `> **Wiek:** \`${d.age} lat\` | **Płeć:** \`${d.gender}\`\n`;
    md += `> **Pochodzenie:** \`${d.origin}\`\n`;
    md += `> **Zawód / Rola:** \`${d.job}\`\n\n`;

    md += `**▸ CECHY & ZBALANSOWANIE POSTACI (ANTI-POWERGAMING):**\n`;
    if (d.traits) md += `> 🟢 **Zalety / Mocne strony:** ${d.traits}\n`;
    if (d.flaws) md += `> 🔴 **Wady charakteru:** ${d.flaws}\n`;
    if (d.phobias) md += `> ⚠️ **Fobie i ograniczenia fizyczne:** ${d.phobias}\n`;
    if (d.features) md += `> 🔍 **Znaki szczególne & styl:** ${d.features}\n\n`;

    md += `**▸ HISTORIA POSTACI (BACKSTORY):**\n`;
    md += `\`\`\`text\n${safeBackstory}\n\`\`\`\n\n`;

    if (d.goals) {
      md += `**▸ CELE I MOTYWACJE W MIEŚCIE:**\n`;
      md += `> ${safeGoals}\n\n`;
    }

    md += `*— Wygenerowano za pomocą VIRP.pl (Hub Społeczności GTA 6)*`;

    try {
      await navigator.clipboard.writeText(md);
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Skopiowano podanie w formacie Discord Markdown! 💬', 'success');
      }
    } catch (e) {
      const textarea = document.createElement('textarea');
      textarea.value = md;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        if (typeof VIRP !== 'undefined' && VIRP.showToast) {
          VIRP.showToast('Skopiowano podanie w formacie Discord Markdown! 💬', 'success');
        }
      } finally {
        if (textarea.parentNode) {
          textarea.parentNode.removeChild(textarea);
        }
      }
    }
  },

  /**
   * Pomocniczy hasz dla numeru licencji
   */
  hashCode(str) {
    let hash = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  },

  /**
   * Kopiowanie karty postaci do schowka (zwykły tekst)
   */
  async copyCharacterToClipboard() {
    if (!this._lastGeneratedCard) {
      const nameInput = document.getElementById('char-name')?.value.trim();
      const backstoryInput = document.getElementById('char-backstory')?.value.trim();
      if (nameInput && backstoryInput) {
        this.generateCharacterCard();
      } else {
        VIRP.showToast('Najpierw wygeneruj kartę postaci!', 'info');
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(this._lastGeneratedCard);
      if (typeof VIRP !== 'undefined' && VIRP.showToast) {
        VIRP.showToast('Karta skopiowana do schowka! 📋', 'success');
      }
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = this._lastGeneratedCard;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        if (typeof VIRP !== 'undefined' && VIRP.showToast) {
          VIRP.showToast('Karta skopiowana do schowka! 📋', 'success');
        }
      } finally {
        if (textarea.parentNode) {
          textarea.parentNode.removeChild(textarea);
        }
      }
    }
  },

  /**
   * Eksport karty postaci do pliku .txt
   */
  exportCharacterToTxt() {
    if (!this._lastGeneratedCard) {
      const nameInput = document.getElementById('char-name')?.value.trim();
      const backstoryInput = document.getElementById('char-backstory')?.value.trim();
      if (nameInput && backstoryInput) {
        this.generateCharacterCard();
      } else {
        VIRP.showToast('Najpierw wygeneruj kartę postaci!', 'info');
        return;
      }
    }

    const charName = document.getElementById('char-name')?.value.trim() || 'postac';
    const safeName = charName.replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ\s]/g, '').replace(/\s+/g, '_');
    const filename = `karta_postaci_${safeName}.txt`;

    const blob = new Blob([this._lastGeneratedCard], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    VIRP.showToast(`Wyeksportowano jako ${filename} 📄`, 'success');
  },

  /**
   * Wyczyszczenie formularza postaci
   */
  clearCharacterForm() {
    const fields = ['char-name', 'char-origin', 'char-job', 'char-traits', 'char-flaws', 'char-phobias', 'char-features', 'char-backstory', 'char-goals'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    const ageEl = document.getElementById('char-age');
    if (ageEl) ageEl.value = '28';

    const genderEl = document.getElementById('char-gender');
    if (genderEl) genderEl.value = 'Mężczyzna';

    const avatarEl = document.getElementById('char-avatar-type');
    if (avatarEl) avatarEl.value = 'street';

    // Reset aktywnych przycisków archetypów
    document.querySelectorAll('.char-preset-btn').forEach(b => b.classList.remove('active'));

    const output = document.getElementById('char-output');
    if (output) {
      output.textContent = '// Wypełnij formularz lub kliknij "Wylosuj Postać" aby wygenerować dokument...';
      output.style.color = '';
    }

    this._lastGeneratedCard = null;
    this._currentCharData = null;
    this.renderDefaultIdCanvas();

    VIRP.showToast('Wyczyszczono formularz!', 'info');
  },

  /* ===========================================================
     2. KODY RADIOWE & PROCEDURY
     =========================================================== */

  /**
   * Baza kodów 10-codes i procedur
   */
  codesData: {
    '10codes': [
      { code: '10-0', desc: 'Brak odpowiedzi / Anulowanie ostatniego komunikatu', category: 'Komunikacja' },
      { code: '10-1', desc: 'Słaby odbiór sygnału radiowego', category: 'Komunikacja' },
      { code: '10-2', desc: 'Dobry / wyraźny odbiór sygnału', category: 'Komunikacja' },
      { code: '10-3', desc: 'Cisza radiowa / Zaprzestań nadawania', category: 'Komunikacja' },
      { code: '10-4', desc: 'Przyjąłem / Zrozumiałem (Roger)', category: 'Komunikacja' },
      { code: '10-5', desc: 'Przekaż wiadomość dalej do jednostki', category: 'Komunikacja' },
      { code: '10-6', desc: 'Jestem zajęty (chyba, że sprawa pilna)', category: 'Status' },
      { code: '10-7', desc: 'Zejście ze służby / Poza służbą (Off-duty)', category: 'Status' },
      { code: '10-8', desc: 'Wejście na służbę / W gotowości (On-duty)', category: 'Status' },
      { code: '10-9', desc: 'Powtórz ostatnią wiadomość', category: 'Komunikacja' },
      { code: '10-10', desc: 'Bójka / starcie wręcz w toku', category: 'Zdarzenie' },
      { code: '10-11', desc: 'Zagrożenie zwierzęce / Pies na drodze', category: 'Zdarzenie' },
      { code: '10-12', desc: 'Obecni cywile / świadkowie w pobliżu', category: 'Informacja' },
      { code: '10-13', desc: 'OFICER W NIEBEZPIECZEŃSTWIE — Potrzebne natychmiastowe wsparcie', category: 'Priorytet' },
      { code: '10-14', desc: 'Podejrzana osoba / podejrzany obiekt', category: 'Zdarzenie' },
      { code: '10-15', desc: 'Podejrzany zatrzymany / w areszcie / na pace radiowozu', category: 'Status' },
      { code: '10-16', desc: 'Awantura / przemoc domowa', category: 'Zdarzenie' },
      { code: '10-17', desc: 'Spotkanie w wyznaczonym punkcie', category: 'Komunikacja' },
      { code: '10-18', desc: 'Pilne zadanie — szybko zrealizuj / zakończ', category: 'Priorytet' },
      { code: '10-19', desc: 'Powrót na posterunek / stację', category: 'Procedura' },
      { code: '10-20', desc: 'Podaj aktualną lokalizację / pozycję jednostki', category: 'Informacja' },
      { code: '10-21', desc: 'Skontaktuj się telefonicznie', category: 'Komunikacja' },
      { code: '10-22', desc: 'Anuluj / Odwołaj ostatnie polecenie', category: 'Komunikacja' },
      { code: '10-23', desc: 'Oczekiwanie / Standby na miejscu', category: 'Status' },
      { code: '10-25', desc: 'Nawiąż kontakt osobisty z...', category: 'Komunikacja' },
      { code: '10-27', desc: 'Sprawdź dane prawa jazdy (Driver License check)', category: 'Procedura' },
      { code: '10-28', desc: 'Sprawdź tablice rejestracyjne pojazdu (Plate check)', category: 'Procedura' },
      { code: '10-29', desc: 'Sprawdź w kartotece osób poszukiwanych (Warrant check)', category: 'Procedura' },
      { code: '10-30', desc: 'Nieprawidłowe użycie częstotliwości radiowej', category: 'Komunikacja' },
      { code: '10-31', desc: 'Przestępstwo w toku', category: 'Zdarzenie' },
      { code: '10-32', desc: 'Osoba z bronią palną', category: 'Zdarzenie' },
      { code: '10-33', desc: 'ALARM — Zagrożenie życia na kanale', category: 'Priorytet' },
      { code: '10-38', desc: 'Zatrzymanie podejrzanego pojazdu (High Risk Stop)', category: 'Procedura' },
      { code: '10-40', desc: 'Patrol cichy / brak sygnałów', category: 'Status' },
      { code: '10-41', desc: 'Rozpoczęcie patrolu (10-8)', category: 'Status' },
      { code: '10-42', desc: 'Zakończenie patrolu (10-7)', category: 'Status' },
      { code: '10-50', desc: 'Wypadek drogowy / kolizja radiowozu', category: 'Zdarzenie' },
      { code: '10-51', desc: 'Wezwij lawetę / holownik', category: 'Procedura' },
      { code: '10-52', desc: 'Wezwij jednostkę ratownictwa medycznego (EMS)', category: 'Procedura' },
      { code: '10-53', desc: 'Droga całkowicie zablokowana', category: 'Informacja' },
      { code: '10-55', desc: 'Kierowca pod wpływem alkoholu/narkotyków (DUI/OVI)', category: 'Zdarzenie' },
      { code: '10-56', desc: 'Nietrzeźwy pieszy stwarzający zagrożenie', category: 'Zdarzenie' },
      { code: '10-60', desc: 'Rutynowa kontrola drogowa (Traffic stop)', category: 'Procedura' },
      { code: '10-66', desc: 'Podejrzane zachowanie / kręcenie się w rejonie', category: 'Zdarzenie' },
      { code: '10-70', desc: 'Pożar — wezwanie straży pożarnej (SAFD)', category: 'Zdarzenie' },
      { code: '10-71', desc: 'Pożar budynku / obiektu', category: 'Zdarzenie' },
      { code: '10-72', desc: 'Płonący pojazd', category: 'Zdarzenie' },
      { code: '10-76', desc: 'W drodze na miejsce zdarzenia (En route)', category: 'Status' },
      { code: '10-78', desc: 'Prośba o pilne wsparcie (Officer needs assistance)', category: 'Priorytet' },
      { code: '10-80', desc: 'Pościg za uciekającym pojazdem (Vehicle pursuit)', category: 'Zdarzenie' },
      { code: '10-90', desc: 'NAPAD W TOKU (sklep / bank / jubiler) — Alarm priorytetowy', category: 'Priorytet' },
      { code: '10-97', desc: 'Przybycie na miejsce zdarzenia (Arrived on scene)', category: 'Status' },
      { code: '10-99', desc: 'OFFICER DOWN — Funkcjonariusz ranny / postrzelony', category: 'Priorytet' },
      { code: '11-99', desc: 'PANIC BUTTON — Bezpośrednie śmiertelne zagrożenie życia (wszystkie jednostki 10-76)', category: 'Priorytet' },
      { code: 'Code 0', desc: 'Zagrożenie życia oficera — najwyższy priorytet radiowy, porzucenie innych czynności', category: 'Priorytet' },
      { code: 'Code 1', desc: 'Odpowiedź rutynowa (bez sygnałów)', category: 'Priorytet' },
      { code: 'Code 2', desc: 'Odpowiedź pilna (sygnały świetlne, bez syreny)', category: 'Priorytet' },
      { code: 'Code 3', desc: 'Odpowiedź alarmowa (pełne koguty + syrena)', category: 'Priorytet' },
      { code: 'Code 4', desc: 'Sytuacja opanowana / Brak potrzeby dalszego wsparcia jednostek', category: 'Status' },
      { code: 'Code 5', desc: 'Stakeout / Obserwacja terenu (inne jednostki omijają dany sektor)', category: 'Procedura' },
      { code: 'Code 6', desc: 'Jednostka poza pojazdem / Prowadzenie czynności w terenie', category: 'Status' },
      { code: 'Status 1', desc: 'Jednostka w drodze na komendę / posterunek', category: 'Status' },
      { code: 'Status 2', desc: 'Jednostka na komendzie — procesowanie aresztowanego (10-15)', category: 'Status' }
    ],

    police: [
      { code: 'Miranda Rights', desc: 'Masz prawo do zachowania milczenia. Wszystko co powiesz może i będzie użyte przeciwko Tobie w sądzie. Masz prawo do adwokata. Jeśli nie stać Cię na adwokata, zostanie Ci przydzielony z urzędu. Czy rozumiesz swoje prawa w brzmieniu, w jakim je odczytałem?', category: 'Procedura' },
      { code: 'Traffic Stop', desc: '1. Włącz sygnalizację świetlną za pojazdem → 2. Poczekaj na zatrzymanie w bezpiecznym miejscu → 3. Zgłoś na radiu 10-60 z lokalizacją i modelem → 4. Podejdź ostrożnie (obserwuj ręce kierowcy) → 5. Przedstaw się, podaj powód zatrzymania i poproś o dokumenty', category: 'Procedura' },
      { code: 'Felony Stop', desc: '1. Zatrzymanie podwyższonego ryzyka: Wezwij wsparcie (Code 3) → 2. Ustaw radiowozy w szyku osłonowym → 3. Przez megafon nakaż wyłączenie silnika, wyrzucenie kluczyków przez okno i uniesienie rąk → 4. Pojedyncze wyprowadzanie pasażerów tyłem do radiowozów → 5. Podejście w asekuracji z bronią gotową', category: 'Procedura' },
      { code: 'PIT Manewr (TVI)', desc: 'Precyzyjne uderzenie narożnikiem radiowozu w tylne koło/błotnik uciekającego pojazdu w celu wprowadzenia go w poślizg i zatrzymania. Wymagana zgoda dowódcy pościgu (Supervisor), prędkość do ok. 55-60 mph, z dala od gęstego ruchu cywilnego.', category: 'Procedura' },
      { code: 'Kolczatka (Spike Strips)', desc: 'Rozłożenie taśmy kolczastej przed trasą uciekającego pojazdu. Wymaga zgłoszenia na radiu ("Spikes ready"), bezpiecznego schronienia za osłoną i natychmiastowego zwinięcia taśmy po przejechaniu celu, aby nie uszkodzić goniących radiowozów.', category: 'Procedura' },
      { code: 'Foot Pursuit', desc: '1. Zgłoś natychmiast na radiu pościg pieszy (10-80 foot pursuit) → 2. Podaj dokładną lokalizację (10-20), kierunek ucieczki i opis ubioru → 3. Nie trać kontaktu wzrokowego → 4. Pamiętaj o bezpieczeństwie osób postronnych → 5. Używaj Tasera przed eskalacją do broni palnej', category: 'Procedura' },
      { code: 'Użycie Siły', desc: 'Drabina Użycia Siły: 1. Obecność funkcjonariusza w mundurze → 2. Polecenia słowne (komendy) → 3. Siła fizyczna / chwyty obezwładniające → 4. Środki przymusu (gaz pieprzowy / Taser) → 5. Pałka policyjna (uderzenia w duże partie mięśniowe) → 6. Broń palna (wyłącznie przy bezpośrednim zagrożeniu życia)', category: 'Procedura' },
      { code: 'Aresztowanie', desc: '1. Poinformuj osobę o zatrzymaniu → 2. Skuj ręce z tyłu (kajdanki) → 3. Przeprowadź przeszukanie bezpieczeństwa / pat-down → 4. Odczytaj prawa Mirandy → 5. Zabezpiecz dowody → 6. Przetransportuj na komendę i sporządź raport procesowy', category: 'Procedura' },
      { code: 'Kontrola Osobista', desc: '1. Poproś o dokumenty tożsamości → 2. Sprawdź w MDT bazy (10-27, 10-28, 10-29) → 3. Przedstaw podstawę prawną kontroli → 4. W przypadku uzasadnionego podejrzenia posiadania nielegalnych przedmiotów przystąp do przeszukania w obecności drugiego oficera', category: 'Procedura' },
      { code: 'Raport Interwencji', desc: 'Obowiązkowe składowe: data i godzina, dokładna lokalizacja, dane uczestników i zatrzymanych (10-15), opis przebiegu interwencji, zabezpieczone dowody / broń / substancje, użyte środki przymusu, podpis i numer odznaki', category: 'Dokumentacja' }
    ],

    medical: [
      { code: 'Triage START', desc: 'Segregacja poszkodowanych przy wypadkach masowych: ZIELONY (poszkodowany chodzący, lekkie urazy) → ŻÓŁTY (wymaga pomocy, brak bezpośredniego zagrożenia życia) → CZERWONY (natychmiastowe zagrożenie życia, priorytet ratowania) → CZARNY (brak oddechu po udrożnieniu dróg, zgon)', category: 'Triage' },
      { code: 'ABCDE', desc: 'Podstawowy schemat badania urazowego: A — Airway (drogi oddechowe z ochroną kręgosłupa szyjnego) → B — Breathing (ocena oddechu i saturacji) → C — Circulation (krążenie, tętno, tamowanie krwotoków) → D — Disability (skala Glasgow/przytomność, źrenice) → E — Exposure (pełne badanie urazowe, ochrona przed wychłodzeniem)', category: 'Ocena' },
      { code: 'SAMPLE (Wywiad)', desc: 'Standardowy wywiad ratowniczy: S — Signs & Symptoms (objawy zgłaszane przez pacjenta) → A — Allergies (uczulenia na leki) → M — Medications (stale przyjmowane lekarstwa) → P — Past medical history (przebyte choroby/operacje) → L — Last oral intake (ostatni posiłek) → E — Events (okoliczności zdarzenia)', category: 'Wywiad' },
      { code: 'CPR / RKO', desc: 'Resuscytacja krążeniowo-oddechowa: 1. Sprawdź bezpieczeństwo i przytomność → 2. Udrożnij drogi oddechowe → 3. Brak oddechu = wezwij wsparcie i AED → 4. Rytm 30 uciśnięć klatki piersiowej (głębokość 5-6 cm, tempo 100-120/min) na 2 wdechy ratownicze → 5. Kontynuuj do przybycia zespołu lub powrotu funkcji życiowych', category: 'Procedura' },
      { code: 'GSW (Rana Postrzałowa)', desc: '1. Zabezpiecz miejsce z policją → 2. Zlokalizuj ranę wlotową i wylotową → 3. Krwotok z kończyny: natychmiast załóż stazę taktyczną (turnikiet CAT) 5 cm powyżej rany → 4. Rana klatki piersiowej: opatrunek wentylowy (Chest Seal) zapobiegający odmie prężnej → 5. Tlenoterapia i pilny transport Code 3 do szpitala', category: 'Procedura' },
      { code: 'Złamania i Zwichnięcia', desc: '1. Nie przemieszczaj poszkodowanego bez stabilizacji → 2. Sprawdź tętno, czucie i ruchomość poniżej miejsca złamania (badanie obwodowe) → 3. Unieruchom dwa sąsiednie stawy za pomocą szyny Kramera lub deski ortopedycznej → 4. Załóż zimny okład (RP) → 5. Podaj leki przeciwbólowe', category: 'Procedura' },
      { code: 'Oparzenia Termiczne', desc: 'Klasyfikacja: I stopień (rumień), II stopień (pęcherze z płynem), III stopień (martwica tkanek). Postępowanie: 1. Schładzaj czystą, chłodną wodą przez 10-15 minut → 2. Nie przekłuwaj pęcherzy i nie stosuj tłuszczów → 3. Załóż sterylny hydrożel lub suchy opatrunek jałowy → 4. Zabezpiecz przed hipotermią', category: 'Procedura' },
      { code: 'Przedawkowanie (OD)', desc: '1. Sprawdź drożność dróg oddechowych i rytm oddechowy → 2. Podejrzenie opioidów (szpilkowate źrenice, sinica, bezdech): podaj Nalokson (Narcan) donosowo lub domięśniowo → 3. Tlenoterapia bierna/czynna → 4. Ułożenie w pozycji bezpiecznej → 5. Monitorowanie do przybycia na SOR', category: 'Procedura' },
      { code: 'Kody Szpitalne EMS', desc: 'Code Green — urazy powierzchowne / Code Yellow — urazy wymagające diagnostyki / Code Red — krytyczne zagrożenie życia (urazówka natychmiast) / Code Black — stwierdzenie zgonu / Mass Cas Incident — zdarzenie z dużą liczbą poszkodowanych', category: 'Kody' }
    ]
  },

  /**
   * Pomocniczy debounce
   */
  debounce(fn, delay) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Inicjalizacja sekcji kodów radiowych
   */
  initRadioCodes() {
    // Render domyślne 10-codes
    this.renderCodesTable('10codes');

    // Nawigacja zakładek
    document.querySelectorAll('[data-codes-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update tabs
        document.querySelectorAll('[data-codes-tab]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.codesTab;
        this.activeCodesTab = tab;
        this.renderCodesTable(tab);
      });
    });

    // Wyszukiwarka kodów z debounce
    const searchInput = document.getElementById('codes-search');
    if (searchInput) {
      const debouncedSearch = this.debounce((query) => {
        this.renderCodesTable(this.activeCodesTab, query);
      }, 200);

      searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value.trim().toLowerCase());
      });
    }
  },

  /**
   * Renderowanie tabeli kodów
   * @param {string} tabName - Nazwa zakładki
   * @param {string} searchQuery - Fraza wyszukiwania (opcjonalnie)
   */
  renderCodesTable(tabName, searchQuery = '') {
    const container = document.getElementById('codes-content');
    if (!container) return;

    let codes = this.codesData[tabName] || [];

    // Filtruj po frazie
    if (searchQuery) {
      codes = codes.filter(item => {
        return item.code.toLowerCase().includes(searchQuery) ||
               item.desc.toLowerCase().includes(searchQuery) ||
               item.category.toLowerCase().includes(searchQuery);
      });
    }

    if (codes.length === 0) {
      container.innerHTML = `
        <div class="empty-state py-8">
          <p class="text-slate-500">Brak wyników dla podanej frazy.</p>
        </div>
      `;
      return;
    }

    const categoryHeader = tabName === '10codes' ? 'Kategoria' : 'Typ';

    let html = `
      <table class="codes-table">
        <thead>
          <tr>
            <th style="width: 140px;">Kod</th>
            <th>Opis / Procedura</th>
            <th style="width: 120px;">${categoryHeader}</th>
          </tr>
        </thead>
        <tbody>
    `;

    codes.forEach(item => {
      const safeCode = typeof sanitize === 'function' ? sanitize(item.code) : item.code;
      const safeDesc = typeof sanitize === 'function' ? sanitize(item.desc) : item.desc;
      const safeCat = typeof sanitize === 'function' ? sanitize(item.category) : item.category;
      html += `
        <tr>
          <td><span class="code-badge">${safeCode}</span></td>
          <td class="text-sm">${safeDesc}</td>
          <td><span class="text-xs text-slate-500">${safeCat}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  },

  /* ===========================================================
     3. KALKULATOR EKONOMII RP
     =========================================================== */

  /**
   * Inicjalizacja kalkulatora ekonomii
   */
  initCalculator() {
    const calcBtn = document.getElementById('calc-btn');
    const multiplierRange = document.getElementById('calc-multiplier');
    const multiplierValue = document.getElementById('calc-multiplier-value');

    // Update multiplier label
    if (multiplierRange && multiplierValue) {
      multiplierRange.addEventListener('input', () => {
        multiplierValue.textContent = `${parseFloat(multiplierRange.value).toFixed(1)}x`;
      });
    }

    // Calculate
    if (calcBtn) {
      calcBtn.addEventListener('click', () => this.calculateEarnings());
    }

    // Auto-calculate on activity change
    const activitySelect = document.getElementById('calc-activity');
    const quantityInput = document.getElementById('calc-quantity');

    if (quantityInput) {
      quantityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.calculateEarnings();
        }
      });
    }

    if (activitySelect) {
      activitySelect.addEventListener('change', () => {
        // Auto-set quantity hint based on unit
        const selected = activitySelect.options[activitySelect.selectedIndex];
        if (selected && selected.dataset.unit) {
          if (quantityInput) {
            quantityInput.placeholder = `Ilość (${selected.dataset.unit})`;
          }
        }
      });
    }
  },

  /**
   * Obliczanie zarobków
   */
  calculateEarnings() {
    const activitySelect = document.getElementById('calc-activity');
    const quantityInput = document.getElementById('calc-quantity');
    const multiplierRange = document.getElementById('calc-multiplier');
    const resultAmount = document.getElementById('calc-result-amount');
    const resultDesc = document.getElementById('calc-result-desc');

    if (!activitySelect || !activitySelect.value) {
      VIRP.showToast('Wybierz typ aktywności!', 'info');
      return;
    }

    const selected = activitySelect.options[activitySelect.selectedIndex];
    const rate = parseInt(selected.dataset.rate, 10) || 0;
    const unit = selected.dataset.unit || '';
    const rawQty = parseInt(quantityInput?.value, 10);
    const quantity = isNaN(rawQty) || rawQty < 1 ? 1 : Math.min(rawQty, 1000);
    const multiplier = parseFloat(multiplierRange?.value) || 1;

    const total = Math.round(rate * quantity * multiplier);

    // Animacja wyniku
    if (resultAmount) {
      this.animateValue(resultAmount, total);
    }

    if (resultDesc) {
      const activityName = selected.textContent.split('(')[0].trim();
      resultDesc.textContent = `${activityName} × ${quantity} ${unit} × ${multiplier.toFixed(1)}x`;
    }
  },

  _activeCalcAnim: null,

  /**
   * Animacja wartości liczbowej
   * @param {HTMLElement} element - Element docelowy
   * @param {number} target - Docelowa wartość
   */
  animateValue(element, target) {
    if (this._activeCalcAnim) {
      cancelAnimationFrame(this._activeCalcAnim);
      this._activeCalcAnim = null;
    }

    const duration = 800;
    const startTime = performance.now();
    const startText = element.textContent;
    const startVal = parseInt(startText.replace(/[^0-9]/g, ''), 10) || 0;

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const current = Math.round(startVal + (target - startVal) * eased);
      element.textContent = `$${current.toLocaleString('pl-PL')}`;

      if (progress < 1) {
        this._activeCalcAnim = requestAnimationFrame(update);
      } else {
        this._activeCalcAnim = null;
      }
    };

    this._activeCalcAnim = requestAnimationFrame(update);
  }
};


/* ============================================================
   Inicjalizacja
   ============================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    RPToolkit.init();
  });
} else {
  RPToolkit.init();
}
