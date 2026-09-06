/**
 * VIRP.pl — Cloudflare Worker Backend (Proxy & Anty-Spam Gateway)
 * Adres produkcyjny: https://virp-proxy.chojmarcel.workers.dev/
 * 
 * Funkcjonalności:
 * 1. Ochrona SSRF na proxy statystyk graczy na żywo (ALLOWED_STATS_HOSTS)
 * 2. Anty-spam i rate limit po IP (5 minut cooldownu z czyszczeniem pamięci Map i wsparciem Cloudflare KV)
 * 3. Twarda blokada nieautoryzowanych domen Origin (403 Forbidden dla botów i curl)
 * 4. Prawidłowa strefa czasowa Polska (Europe/Warsaw) w stopce Discord Embed
 * 5. Sanityzacja danych i blokada szkodliwych linków (wymuszenie protokołów http/https)
 */

// Pamięć podręczna na poziomie instancji z limitem wpisów (ochrona przed OOM)
const ipCooldowns = new Map();
const MAX_COOLDOWN_ENTRIES = 5000;

function setIpCooldown(key, timestamp) {
  if (ipCooldowns.size >= MAX_COOLDOWN_ENTRIES) {
    const oldestKey = ipCooldowns.keys().next().value;
    if (oldestKey) ipCooldowns.delete(oldestKey);
  }
  ipCooldowns.set(key, timestamp);
}

// Pamięć podręczna tokenów OAuth (redukuje zapytania do Twitch / Kick)
let cachedTwitchToken = null;
let twitchTokenExpiry = 0;

let cachedKickToken = null;
let kickTokenExpiry = 0;

// Biała lista domen, które Worker może odpytywać o statystyki (Ochrona przed SSRF)
const ALLOWED_STATS_HOSTS = [
  'api.strefarp.gg',
  'servers-frontend.fivem.net',
  'frontend.cfx-services.net',
  'cdn.rage.mp'
];

/**
 * Escapowanie znaków specjalnych Discord Markdown, aby zapobiec wstrzykiwaniu formatowania i fałszywych linków
 */
function escapeDiscordMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/([\\\[\]\(\)*_~`|>])/g, '\\$1');
}

/**
 * Weryfikacja tokena Cloudflare Turnstile po stronie serwera
 * @param {string} token - Token wygenerowany przez widget Turnstile
 * @param {string} clientIP - IP użytkownika
 * @param {string} secretKey - Klucz prywatny TURNSTILE_SECRET_KEY ze zmiennych env
 */
async function verifyTurnstile(token, clientIP, secretKey) {
  if (!secretKey) {
    console.error('[Worker Turnstile] TURNSTILE_SECRET_KEY nie jest skonfigurowany w środowisku.');
    return { success: false, error: 'Błąd konfiguracji zabezpieczeń serwera' };
  }
  if (!token) {
    return { success: false, error: 'Wymagana weryfikacja anty-bot Turnstile' };
  }
  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (clientIP && clientIP !== 'unknown') {
      formData.append('remoteip', clientIP);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(6000)
    });
    const outcome = await res.json();
    return {
      success: Boolean(outcome.success),
      error: outcome.success ? null : 'Weryfikacja anty-bot Turnstile nie powiodła się'
    };
  } catch (err) {
    console.error('[Worker Turnstile Verify Error]:', err);
    return { success: false, error: 'Błąd połączenia z serwerem Turnstile' };
  }
}

export default {
  async fetch(request, env) {
    const allowedOrigins = [
      'https://virp.pl',
      'http://127.0.0.1:5500',
      'http://localhost:3000',
      'http://localhost:5173'
    ];
    const origin = request.headers.get('Origin') || '';
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    
    let isAllowed = allowedOrigins.includes(origin) || isLocalhost;
    if (!isAllowed && origin) {
      try {
        const parsedOrigin = new URL(origin);
        if (parsedOrigin.protocol === 'https:' && (
          parsedOrigin.hostname === 'virp.pl' ||
          parsedOrigin.hostname.endsWith('.virp.pl') ||
          parsedOrigin.hostname.endsWith('.pages.dev')
        )) {
          isAllowed = true;
        }
      } catch (_) {}
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : 'https://virp.pl',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Secret',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    };

    // 1. Obsługa preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const normalizedPath = url.pathname.replace(/\/$/, '');

    // 0. Endpoint statusu / Health check (GET /, /health lub /api/health)
    if (request.method === 'GET' && (normalizedPath === '' || normalizedPath === '/health' || normalizedPath === '/api/health')) {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'VIRP.pl Proxy & Anty-Spam Gateway',
        timestamp: new Date().toISOString(),
        version: '2.0.0'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      });
    }

    // Zabezpieczenie przed floodem i zbyt dużym rozmiarem przy POST
    if (request.method === 'POST') {
      const rawLen = request.headers.get('content-length');
      if (rawLen) {
        const contentLength = parseInt(rawLen, 10);
        if (isNaN(contentLength) || contentLength <= 0 || contentLength > 50 * 1024) {
          return new Response(JSON.stringify({ error: 'Nieprawidłowy lub zbyt duży rozmiar zapytania (max 50 KB)' }), {
            status: 413,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      const contentType = (request.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Wymagany nagłówek Content-Type: application/json' }), {
          status: 415,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =========================================================================
    // 2. PROXY STATYSTYK GRACZY NA ŻYWO (GET /api/stats) — ZABEZPIECZONE SSRF
    // =========================================================================
    if (request.method === 'GET' && normalizedPath === '/api/stats') {
      const rawTargetUrl = url.searchParams.get('url') || 'https://api.strefarp.gg/api/stats';
      
      try {
        const parsedTarget = new URL(rawTargetUrl);
        
        // Weryfikacja protokołu oraz hosta docelowego na białej liście (antidotum na SSRF)
        if (!['https:', 'http:'].includes(parsedTarget.protocol) || !ALLOWED_STATS_HOSTS.includes(parsedTarget.hostname)) {
          return new Response(JSON.stringify({ error: 'Niedozwolony host docelowy' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Weryfikacja portów (blokada niestandardowych portów wewnętrznych)
        if (parsedTarget.port && !['443', '80', ''].includes(parsedTarget.port)) {
          return new Response(JSON.stringify({ error: 'Niedozwolony port docelowy' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Bezpieczny timeout kompatybilny ze wszystkimi środowiskami Cloudflare Workers
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 6500) : null;

        let statsRes;
        try {
          statsRes = await fetch(parsedTarget.toString(), {
            redirect: 'follow',
            headers: { 
              'User-Agent': 'VIRP-Proxy/1.2.1 (https://virp.pl)',
              'Accept': 'application/json, text/plain, */*'
            },
            signal: controller ? controller.signal : undefined
          });
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }

        const resContentLength = parseInt(statsRes.headers.get('content-length') || '0', 10);
        if (resContentLength > 2 * 1024 * 1024) {
          return new Response(JSON.stringify({ error: 'Odpowiedź serwera docelowego jest zbyt duża' }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const statsData = await statsRes.text();
        return new Response(statsData, {
          status: statsRes.status,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=15'
          }
        });
      } catch (err) {
        return new Response(JSON.stringify({ 
          error: 'Nie udało się pobrać statystyk serwera',
          details: err?.message || String(err)
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =========================================================================
    // 3. PROXY STATUSÓW LIVE TWITCH & KICK (GET /api/streamers)
    // =========================================================================
    if (request.method === 'GET' && normalizedPath === '/api/streamers') {
      const debugRequested = url.searchParams.get('debug') === '1';
      // Bezpieczny tryb debugowania: wymaga tokenu ADMIN_DEBUG_SECRET
      const isDebug = debugRequested && env?.ADMIN_DEBUG_SECRET && request.headers.get('X-Admin-Secret') === env.ADMIN_DEBUG_SECRET;

      const twitchParam = url.searchParams.get('twitch') || (url.searchParams.get('kick') ? '' : url.searchParams.get('logins')) || '';
      const kickParam = url.searchParams.get('kick') || '';

      if (!twitchParam && !kickParam && !isDebug) {
        return new Response(JSON.stringify({ error: 'Brak parametrów twitch lub kick' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Sprawdź cache Cloudflare (60 sekund) — omiń przy trybie debugowania
      const cacheKey = new Request(url.toString(), request);
      const cache = typeof caches !== 'undefined' ? caches.default : null;
      if (cache && !isDebug) {
        try {
          const cachedRes = await cache.match(cacheKey);
          if (cachedRes) return cachedRes;
        } catch (cErr) {}
      }

      const activeStreams = {};
      const debugData = isDebug ? {
        timestamp: new Date().toISOString(),
        hasTwitchClientId: Boolean(env?.TWITCH_CLIENT_ID),
        hasTwitchClientSecret: Boolean(env?.TWITCH_CLIENT_SECRET),
        hasKickClientId: Boolean(env?.KICK_CLIENT_ID),
        hasKickClientSecret: Boolean(env?.KICK_CLIENT_SECRET),
        twitchParam,
        kickParam
      } : null;

      // --- 1. TWITCH HELIX API ---
      if (twitchParam && env && env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET) {
        try {
          const tClientId = String(env.TWITCH_CLIENT_ID).trim();
          const tClientSecret = String(env.TWITCH_CLIENT_SECRET).trim();

          let tAppToken = null;
          const nowMs = Date.now();
          if (cachedTwitchToken && nowMs < twitchTokenExpiry) {
            tAppToken = cachedTwitchToken;
          } else {
            const tTokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${tClientId}&client_secret=${tClientSecret}&grant_type=client_credentials`, {
              method: 'POST',
              signal: AbortSignal.timeout(7000)
            });
            const tTokenData = await tTokenRes.json();
            tAppToken = tTokenData.access_token;
            if (tAppToken) {
              cachedTwitchToken = tAppToken;
              twitchTokenExpiry = nowMs + Math.max(0, ((tTokenData.expires_in || 3600) - 300)) * 1000;
            }
          }

          if (debugData) {
            debugData.twitchTokenOk = Boolean(tAppToken);
          }

          if (tAppToken) {
            const tLogins = twitchParam.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
            const queryParams = tLogins.slice(0, 100).map(l => `user_login=${encodeURIComponent(l)}`).join('&');

            const helixRes = await fetch(`https://api.twitch.tv/helix/streams?${queryParams}`, {
              headers: {
                'Client-ID': tClientId,
                'Authorization': `Bearer ${tAppToken}`
              },
              signal: AbortSignal.timeout(7000)
            });
            const helixData = await helixRes.json();

            if (debugData) {
              debugData.twitchStreamsCount = helixData.data?.length || 0;
            }

            if (helixData.data && Array.isArray(helixData.data)) {
              helixData.data.forEach(stream => {
                const thumb = stream.thumbnail_url
                  ? stream.thumbnail_url.replace('{width}', '640').replace('{height}', '360')
                  : null;
                activeStreams[stream.user_login.toLowerCase()] = {
                  platform: 'twitch',
                  isLive: true,
                  game: stream.game_name,
                  title: stream.title,
                  viewers: stream.viewer_count,
                  thumbnail: thumb
                };
              });
            }
          }
        } catch (tErr) {
          console.error('[Worker] Błąd pobierania Twitch:', tErr);
          if (debugData) debugData.twitchError = tErr.message;
        }
      }

      // --- 2. KICK OFFICIAL DEVELOPER API (OpenAPI v1) ---
      if (kickParam && env && env.KICK_CLIENT_ID && env.KICK_CLIENT_SECRET) {
        try {
          const kClientId = String(env.KICK_CLIENT_ID).trim();
          const kClientSecret = String(env.KICK_CLIENT_SECRET).trim();

          let kAppToken = null;
          const nowKickMs = Date.now();
          if (cachedKickToken && nowKickMs < kickTokenExpiry) {
            kAppToken = cachedKickToken;
          } else {
            const kTokenRes = await fetch('https://id.kick.com/oauth/token', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
              },
              body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: kClientId,
                client_secret: kClientSecret
              }),
              signal: AbortSignal.timeout(7000)
            });
            const kTokenData = await kTokenRes.json();
            kAppToken = kTokenData.access_token;
            if (kAppToken) {
              cachedKickToken = kAppToken;
              kickTokenExpiry = nowKickMs + Math.max(0, ((kTokenData.expires_in || 3600) - 300)) * 1000;
            }
          }

          if (debugData) {
            debugData.kickTokenOk = Boolean(kAppToken);
            if (!kAppToken) debugData.kickTokenError = 'Failed to acquire Kick access token';
          }

          if (kAppToken) {
            const kLogins = kickParam.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
            if (kLogins.length > 0) {
              // Oficjalny endpoint Kick v1: GET /public/v1/channels?slug=channel1&slug=channel2
              const queryParams = kLogins.slice(0, 50).map(l => `slug=${encodeURIComponent(l)}`).join('&');

              const kickRes = await fetch(`https://api.kick.com/public/v1/channels?${queryParams}`, {
                headers: {
                  'Authorization': `Bearer ${kAppToken}`,
                  'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(7000)
              });

              if (debugData) {
                debugData.kickChannelsStatus = kickRes.status;
              }

              if (kickRes.ok) {
                const kickJson = await kickRes.json();
                const channels = Array.isArray(kickJson.data) ? kickJson.data : (kickJson.data ? [kickJson.data] : []);

                if (debugData) {
                  debugData.kickChannelsCount = channels.length;
                  debugData.kickChannelsList = channels.map(c => ({
                    slug: c.slug,
                    hasStream: Boolean(c.stream),
                    isLive: Boolean(c.stream && c.stream.is_live),
                    viewers: c.stream?.viewer_count,
                    title: c.stream_title,
                    category: c.category?.name
                  }));
                }

                for (const ch of channels) {
                  if (ch && ch.slug) {
                    const slug = ch.slug.toLowerCase();
                    const stream = ch.stream;
                    if (stream && stream.is_live) {
                      const kickThumb = (stream.thumbnail && !stream.thumbnail.includes('default-thumbnail'))
                        ? stream.thumbnail
                        : (ch.banner_picture || null);
                      activeStreams[slug] = {
                        platform: 'kick',
                        isLive: true,
                        game: ch.category?.name || 'Grand Theft Auto V',
                        title: ch.stream_title || '',
                        viewers: Number(stream.viewer_count) || 0,
                        thumbnail: kickThumb
                      };
                    }
                  }
                }
              } else {
                const kickErrText = await kickRes.text();
                console.error('[Worker Kick Channels Error]:', kickRes.status, kickErrText);
                if (debugData) debugData.kickChannelsError = 'Channels request failed';
              }
            }
          } else {
            console.error('[Worker Kick Token Error]: Brak tokenu Kick');
          }
        } catch (kErr) {
          console.error('[Worker] Błąd pobierania Kick:', kErr);
          if (debugData) debugData.kickError = kErr.message;
        }
      } else if (debugData && kickParam) {
        debugData.kickSkipped = {
          reason: 'Brak poświadczeń Kick API w zmiennych środowiskowych Workera'
        };
      }

      const responsePayload = { live: activeStreams };
      if (debugData) {
        responsePayload.debug = debugData;
      }

      const outResponse = new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': isDebug ? 'no-store' : 'public, max-age=60'
        }
      });

      if (cache && !isDebug) {
        try {
          await cache.put(cacheKey, outResponse.clone());
        } catch (putErr) {}
      }
      return outResponse;
    }

    // =========================================================================
    // 4. FORMULARZ ZGŁOSZENIA STREAMERA / TWÓRCY (POST /api/streamer-submit)
    // =========================================================================
    if (request.method === 'POST' && (normalizedPath === '/api/streamer-submit' || normalizedPath === '/api/streamers')) {
      if (!isAllowed) {
        return new Response(JSON.stringify({ error: 'Brak uprawnień: Zapytanie odrzucone' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const now = Date.now();
      const COOLDOWN_MS = 5 * 60 * 1000;

      if (env.VIRP_KV) {
        const hasRecentSubmit = await env.VIRP_KV.get(`streamer_cooldown:${clientIP}`);
        if (hasRecentSubmit) {
          return new Response(JSON.stringify({ error: 'Zbyt częste zgłoszenia twórcy. Odczekaj 5 minut przed kolejnym.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        for (const [ip, timestamp] of ipCooldowns.entries()) {
          if (now - timestamp > COOLDOWN_MS) ipCooldowns.delete(ip);
        }
        const lastSubmit = ipCooldowns.get(`streamer:${clientIP}`);
        if (lastSubmit && (now - lastSubmit) < COOLDOWN_MS) {
          const remainingMinutes = Math.ceil((COOLDOWN_MS - (now - lastSubmit)) / 60000);
          return new Response(JSON.stringify({ error: `Odczekaj jeszcze ${remainingMinutes} min przed kolejnym zgłoszeniem.` }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      try {
        if (!env.DISCORD_WEBHOOK_2) {
          return new Response(JSON.stringify({ error: 'Błąd konfiguracji serwera (brak DISCORD_WEBHOOK_2)' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let data;
        try {
          data = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Nieprawidłowy format danych JSON' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Honeypot check (anty-bot)
        if (data.hp || data.streamer_hp_check) {
          return new Response(JSON.stringify({ error: 'Odrzucono zgłoszenie' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Weryfikacja Cloudflare Turnstile
        const turnstileCheck = await verifyTurnstile(data.turnstileToken, clientIP, env.TURNSTILE_SECRET_KEY);
        if (!turnstileCheck.success) {
          return new Response(JSON.stringify({ error: turnstileCheck.error || 'Weryfikacja anty-bot nie powiodła się. Odśwież stronę i spróbuj ponownie.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const rawStreamerName = String(data.name || '').trim();
        const rawChannelUrl = String(data.channelUrl || '').trim();

        if (!rawStreamerName || !rawChannelUrl) {
          return new Response(JSON.stringify({ error: 'Wypełnij wymagane pola (Nick twórcy, Link do kanału)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Sanityzacja danych
        const safeName = rawStreamerName.substring(0, 60);
        const safeNameEscaped = escapeDiscordMarkdown(safeName);

        const rawPlatform = String(data.platform || 'kick').toLowerCase().trim();
        const safePlatform = ['kick', 'twitch', 'youtube'].includes(rawPlatform) ? rawPlatform : 'kick';
        
        let safeChannelUrl = rawChannelUrl;
        if (!safeChannelUrl.startsWith('http://') && !safeChannelUrl.startsWith('https://')) {
          safeChannelUrl = `https://${safeChannelUrl}`;
        }
        safeChannelUrl = safeChannelUrl.substring(0, 150);

        // Automatyczne wyciąganie loginu z adresu URL, jeśli nie podano
        let safeLogin = String(data.channelLogin || '').replace(/[^\w\-\.]/g, '').substring(0, 50);
        if (!safeLogin && safeChannelUrl) {
          try {
            const parsed = new URL(safeChannelUrl);
            const pathParts = parsed.pathname.split('/').filter(Boolean);
            safeLogin = pathParts[pathParts.length - 1] || safeName.toLowerCase().replace(/\s+/g, '');
          } catch {
            safeLogin = safeName.toLowerCase().replace(/\s+/g, '');
          }
        }

        const safeGame = escapeDiscordMarkdown(String(data.game || '').trim().substring(0, 60)) || 'GTA V Roleplay';
        const safeViewers = escapeDiscordMarkdown(String(data.viewers || '').trim().substring(0, 40)) || '*Nie podano*';
        const safeDiscord = escapeDiscordMarkdown(String(data.discord || '').trim().substring(0, 80)) || '*Nie podano*';
        const safeDesc = escapeDiscordMarkdown(String(data.description || '').trim().substring(0, 500)) || null;

        // Kolor embedu w zależności od platformy
        let embedColor = 16719741; // neon pink
        if (safePlatform === 'kick') embedColor = 5504024; // kick green (#53fc18)
        else if (safePlatform === 'twitch') embedColor = 9520895; // twitch purple (#9146ff)
        else if (safePlatform === 'youtube') embedColor = 16711680; // youtube red (#ff0000)

        const polandTime = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

        const discordPayload = {
          username: "VIRP.pl Rekrutacja Twórców",
          avatar_url: "https://virp.pl/img/logo-vi.png",
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: `🎙️ NOWE ZGŁOSZENIE TWÓRCY: ${safeNameEscaped}`,
              color: embedColor,
              description: `Zgłoszenie do katalogu streamerów i twórców **VIRP.pl**`,
              fields: [
                { name: "🎮 Platforma", value: safePlatform.toUpperCase(), inline: true },
                { name: "👤 Wykryty Login", value: `\`@${safeLogin}\``, inline: true },
                { name: "🕹️ Główna Gra", value: safeGame, inline: true },
                { name: "👥 Średnia Widownia", value: safeViewers, inline: true },
                { name: "💬 Kontakt Discord", value: safeDiscord, inline: true },
                { name: "🔗 Link do Kanału", value: safeChannelUrl, inline: false },
                { name: "📝 O Sobie / Serwery RP", value: safeDesc ? safeDesc : "*Brak dodatkowego opisu*", inline: false }
              ],
              footer: {
                text: `VIRP.pl Streamers Gateway • ${polandTime}`
              }
            }
          ]
        };

        const discordRes = await fetch(env.DISCORD_WEBHOOK_2, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
          signal: AbortSignal.timeout(8000)
        });

        if (!discordRes.ok) {
          const errBody = await discordRes.text();
          console.error('[Worker Streamer Webhook Error]:', discordRes.status, errBody);
          return new Response(JSON.stringify({ error: 'Discord odrzucił zgłoszenie twórcy' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (env.VIRP_KV) {
          await env.VIRP_KV.put(`streamer_cooldown:${clientIP}`, '1', { expirationTtl: 300 });
        } else {
          setIpCooldown(`streamer:${clientIP}`, Date.now());
        }

        return new Response(JSON.stringify({ success: true, message: 'Zgłoszenie twórcy zostało przesłane pomyślnie' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        console.error('[Worker Streamer Error]:', err);
        return new Response(JSON.stringify({ error: 'Wystąpił błąd przetwarzania zgłoszenia' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // =========================================================================
    // 5. FORMULARZ ZGŁOSZENIA KLIPU SPOŁECZNOŚCI (POST /api/clip-submit) -> DISCORD_WEBHOOK_3
    // =========================================================================
    if (request.method === 'POST' && (normalizedPath === '/api/clip-submit' || normalizedPath === '/api/clips')) {
      if (!isAllowed) {
        return new Response(JSON.stringify({ error: 'Brak uprawnień: Zapytanie odrzucone' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
      const now = Date.now();
      const COOLDOWN_MS = 5 * 60 * 1000;

      if (env.VIRP_KV) {
        const hasRecentClip = await env.VIRP_KV.get(`clip_cooldown:${clientIP}`);
        if (hasRecentClip) {
          return new Response(JSON.stringify({ error: 'Zbyt częste zgłoszenia klipów. Odczekaj 5 minut przed kolejnym.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        for (const [ip, timestamp] of ipCooldowns.entries()) {
          if (now - timestamp > COOLDOWN_MS) ipCooldowns.delete(ip);
        }
        const lastClip = ipCooldowns.get(`clip:${clientIP}`);
        if (lastClip && (now - lastClip) < COOLDOWN_MS) {
          const remainingMinutes = Math.ceil((COOLDOWN_MS - (now - lastClip)) / 60000);
          return new Response(JSON.stringify({ error: `Odczekaj jeszcze ${remainingMinutes} min przed kolejnym zgłoszeniem klipu.` }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      try {
        if (!env.DISCORD_WEBHOOK_3) {
          return new Response(JSON.stringify({ error: 'Błąd konfiguracji serwera (brak DISCORD_WEBHOOK_3)' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let data;
        try {
          data = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Nieprawidłowy format danych JSON' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Honeypot check (anty-bot)
        if (data.hp || data.clip_hp_check) {
          return new Response(JSON.stringify({ error: 'Odrzucono zgłoszenie' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Weryfikacja Cloudflare Turnstile
        const turnstileCheck = await verifyTurnstile(data.turnstileToken, clientIP, env.TURNSTILE_SECRET_KEY);
        if (!turnstileCheck.success) {
          return new Response(JSON.stringify({ error: turnstileCheck.error || 'Weryfikacja anty-bot nie powiodła się. Odśwież stronę i spróbuj ponownie.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const rawClipUrl = String(data.clipUrl || '').trim().substring(0, 200);
        const rawClipTitle = String(data.title || '').trim();
        const rawClipStreamer = String(data.streamerName || '').trim();

        if (!rawClipUrl || !rawClipTitle || !rawClipStreamer) {
          return new Response(JSON.stringify({ error: 'Wypełnij wymagane pola (Link do klipu, Tytuł akcji, Nazwa twórcy)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Bezpieczna walidacja domen klipów (ochrona przed oszustwami, scamem i phishingiem)
        const ALLOWED_CLIP_HOSTS = [
          'twitch.tv',
          'clips.twitch.tv',
          'www.twitch.tv',
          'kick.com',
          'www.kick.com',
          'youtube.com',
          'www.youtube.com',
          'medal.tv',
          'www.medal.tv',
          'streamable.com',
          'tiktok.com',
          'www.tiktok.com'
        ];

        let safeClipUrl = rawClipUrl;
        if (!safeClipUrl.startsWith('http://') && !safeClipUrl.startsWith('https://')) {
          safeClipUrl = `https://${safeClipUrl}`;
        }

        let parsedClip;
        try {
          parsedClip = new URL(safeClipUrl);
        } catch {
          return new Response(JSON.stringify({ error: 'Podaj poprawny adres URL klipu' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const isExactShortDomain = parsedClip.hostname === 'youtu.be';
        const hostMatches = isExactShortDomain || ALLOWED_CLIP_HOSTS.some(h => parsedClip.hostname === h || parsedClip.hostname.endsWith(`.${h}`));
        
        if (!hostMatches || !['https:', 'http:'].includes(parsedClip.protocol)) {
          return new Response(JSON.stringify({ error: 'Dozwolone są tylko linki z platform: Twitch, Kick, YouTube, Medal, Streamable, TikTok.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const safeTitle = escapeDiscordMarkdown(rawClipTitle.substring(0, 100));
        const safeStreamer = escapeDiscordMarkdown(rawClipStreamer.substring(0, 60)) || '*Twórca*';
        const safeServer = escapeDiscordMarkdown(String(data.serverName || '').trim().substring(0, 60)) || '*Nie podano*';
        const safeSubmitter = escapeDiscordMarkdown(String(data.submitterName || '').trim().substring(0, 60)) || '*Widz (Anonim)*';

        const polandTime = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

        const discordPayload = {
          username: "VIRP.pl System Zgłoszeń Klipów",
          avatar_url: "https://virp.pl/img/logo-vi.png",
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: `🎬 NOWE ZGŁOSZENIE KLIPU: ${safeTitle}`,
              color: 65535, // Neon Cyan (#00f0ff)
              description: `Zgłoszono nowy klip/akcję ze streamu do sekcji **Top Klipy & Akcje Społeczności**`,
              fields: [
                { name: "🎥 Tytuł Akcji", value: `**${safeTitle}**`, inline: false },
                { name: "👤 Streamer / Twórca", value: safeStreamer, inline: true },
                { name: "🎮 Serwer RP / Gra", value: safeServer, inline: true },
                { name: "🙋 Zgłaszający", value: safeSubmitter, inline: true },
                { name: "🔗 Link do Klipu", value: safeClipUrl, inline: false }
              ],
              footer: {
                text: `VIRP.pl Clips Gateway • ${polandTime}`
              }
            }
          ]
        };

        const discordRes = await fetch(env.DISCORD_WEBHOOK_3, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
          signal: AbortSignal.timeout(8000)
        });

        if (!discordRes.ok) {
          const errBody = await discordRes.text();
          console.error('[Worker Clip Webhook Error]:', discordRes.status, errBody);
          return new Response(JSON.stringify({ error: 'Discord odrzucił zgłoszenie klipu' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (env.VIRP_KV) {
          await env.VIRP_KV.put(`clip_cooldown:${clientIP}`, '1', { expirationTtl: 300 });
        } else {
          setIpCooldown(`clip:${clientIP}`, Date.now());
        }

        return new Response(JSON.stringify({ success: true, message: 'Klip został wysłany do weryfikacji! 🎉' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err) {
        console.error('[Worker Clip Error]:', err);
        return new Response(JSON.stringify({ error: 'Wystąpił błąd przetwarzania zgłoszenia klipu' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }


    // =========================================================================
    // 7. FORMULARZ DODAWANIA SERWERA (POST /api/server-submit lub POST /)
    // =========================================================================
    const isServerSubmitPath = normalizedPath === '' || normalizedPath === '/api/server-submit' || normalizedPath === '/api/servers';
    if (request.method === 'POST' && isServerSubmitPath) {

    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Brak uprawnień: Zapytanie odrzucone' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting IP (5 minut cooldownu)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const COOLDOWN_MS = 5 * 60 * 1000;

    if (env.VIRP_KV) {
      const hasRecentSubmit = await env.VIRP_KV.get(`submit_cooldown:${clientIP}`);
      if (hasRecentSubmit) {
        return new Response(JSON.stringify({ error: 'Zbyt częste zgłoszenia. Odczekaj 5 minut przed kolejnym.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Czyszczenie wygasłych IP z pamięci (zapobieganie wyciekowi pamięci)
      for (const [ip, timestamp] of ipCooldowns.entries()) {
        if (now - timestamp > COOLDOWN_MS) ipCooldowns.delete(ip);
      }

      const lastSubmit = ipCooldowns.get(`server:${clientIP}`);
      if (lastSubmit && (now - lastSubmit) < COOLDOWN_MS) {
        const remainingMinutes = Math.ceil((COOLDOWN_MS - (now - lastSubmit)) / 60000);
        return new Response(JSON.stringify({ error: `Odczekaj jeszcze ${remainingMinutes} min przed kolejnym zgłoszeniem.` }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    try {
      if (!env.DISCORD_WEBHOOK_URL) {
        return new Response(JSON.stringify({ error: 'Błąd konfiguracji serwera (brak Webhook URL)' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }


        let data;
        try {
          data = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: 'Nieprawidłowy format danych JSON' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Honeypot check (anty-bot)
        if (data.hp || data.website_hp_check) {
          return new Response(JSON.stringify({ error: 'Odrzucono zgłoszenie' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Weryfikacja Cloudflare Turnstile
        const turnstileCheck = await verifyTurnstile(data.turnstileToken, clientIP, env.TURNSTILE_SECRET_KEY);
        if (!turnstileCheck.success) {
          return new Response(JSON.stringify({ error: turnstileCheck.error || 'Weryfikacja anty-bot nie powiodła się. Odśwież stronę i spróbuj ponownie.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const rawServerName = String(data.name || '').trim();
        const rawDiscord = String(data.discord || '').trim();
        const rawDesc = String(data.description || '').trim();

        if (!rawServerName || !rawDiscord || !rawDesc) {
          return new Response(JSON.stringify({ error: 'Wypełnij wymagane pola (Nazwa, Discord, Opis)' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Sanityzacja ciągów i bezpieczna walidacja protokołów linków
        const safeName = rawServerName.substring(0, 80);
        const safeNameEscaped = escapeDiscordMarkdown(safeName);
        const safeDesc = rawDesc.substring(0, 1000);
        const safeDescEscaped = escapeDiscordMarkdown(safeDesc);
        
        const safeDiscord = (rawDiscord.startsWith('http://') || rawDiscord.startsWith('https://'))
          ? rawDiscord.substring(0, 150)
          : `https://${rawDiscord.substring(0, 140)}`;

        const safeWebsite = (data.website && (String(data.website).trim().startsWith('http://') || String(data.website).trim().startsWith('https://')))
          ? String(data.website).trim().substring(0, 150)
          : null;

        // Oczyszczanie backticków zapobiegające rozbiciu formatowania w Discordzie
        const safeDirect = data.directConnect ? String(data.directConnect).replace(/[`\\]/g, '').trim().substring(0, 80) : null;
        const safeCategory = escapeDiscordMarkdown(String(data.category || 'Roleplay').toUpperCase().substring(0, 30));
        const safePlatform = escapeDiscordMarkdown(String(data.platform || 'FiveM').toUpperCase().substring(0, 20));
        const safeType = escapeDiscordMarkdown(String(data.type || 'Voice').toUpperCase().substring(0, 20));
        const safeSlots = Math.min(Math.max(parseInt(data.slots, 10) || 0, 0), 2048);

        const isWhitelist = data.whitelist === true || data.whitelist === 'true';

        // Bezpieczny URL banera (jeśli podano)
        let safeBanner = null;
        if (data.banner && typeof data.banner === 'string') {
          const trimmedBanner = data.banner.trim();
          if (trimmedBanner.startsWith('http://') || trimmedBanner.startsWith('https://')) {
            safeBanner = trimmedBanner.substring(0, 250);
          }
        }

        const safeTags = Array.isArray(data.tags)
          ? data.tags.slice(0, 5).map(t => `#${escapeDiscordMarkdown(String(t).replace(/[^\w\s\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/gi, '').substring(0, 20))}`).join(' ')
          : '*Brak tagów*';

        // Poprawna strefa czasowa dla Polski (Europe/Warsaw)
        const polandTime = new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });

        const discordPayload = {
          username: "VIRP.pl System Zgłoszeń",
          avatar_url: "https://virp.pl/img/logo-vi.png",
          allowed_mentions: { parse: [] },
          embeds: [
            {
              title: `📥 NOWE ZGŁOSZENIE: ${safeNameEscaped}`,
              color: 16719741,
              description: `**Opis serwera:**\n${safeDescEscaped}`,
              fields: [
                { name: "🎮 Kategoria", value: safeCategory, inline: true },
                { name: "🕹️ Platforma", value: safePlatform, inline: true },
                { name: "🛡️ Whitelist", value: isWhitelist ? "🟢 TAK (WL ON)" : "🟡 NIE (WL OFF)", inline: true },
                { name: "👥 Sloty", value: `${safeSlots} graczy`, inline: true },
                { name: "🎙️ Komunikacja", value: safeType, inline: true },
                { name: "⚡ Direct Connect / IP", value: safeDirect ? `\`${safeDirect}\`` : "*Brak*", inline: true },
                { name: "🔗 Discord Projektu", value: safeDiscord, inline: true },
                { name: "🌐 Strona WWW", value: safeWebsite ? safeWebsite : "*Brak*", inline: true },
                { name: "🏷️ Tagi", value: safeTags || "*Brak*", inline: false }
              ],
              image: safeBanner ? { url: safeBanner } : undefined,
              footer: {
                text: `VIRP.pl Gateway • ${polandTime}`
              }
            }
          ]
        };

        const discordRes = await fetch(env.DISCORD_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(discordPayload),
          signal: AbortSignal.timeout(8000)
        });

        if (!discordRes.ok) {
          return new Response(JSON.stringify({ error: 'Discord odrzucił zgłoszenie' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (env.VIRP_KV) {
          await env.VIRP_KV.put(`submit_cooldown:${clientIP}`, '1', { expirationTtl: 300 });
        } else {
          setIpCooldown(`server:${clientIP}`, Date.now());
        }

        return new Response(JSON.stringify({ success: true, message: 'Zgłoszenie wysłane pomyślnie' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Wystąpił błąd przetwarzania' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // =========================================================================
  // 8. NIEZNANY ENDPOINT (404 Not Found)
  // =========================================================================
  return new Response(JSON.stringify({ error: 'Nie znaleziono endpointu (404 Not Found)' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
};

