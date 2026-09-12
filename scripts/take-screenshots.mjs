import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const USER_DATA_DIR = path.resolve('scratch/chrome_profile');

if (!fs.existsSync(path.resolve('scratch'))) {
  fs.mkdirSync(path.resolve('scratch'), { recursive: true });
}

// 1. Launch Chrome with CDP
const chromeProc = spawn(CHROME_PATH, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${USER_DATA_DIR}`,
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-sync',
  '--window-size=1920,1080'
]);

// Wait for Chrome to be ready
async function waitForChrome(retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return await res.json();
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Chrome failed to start');
}

async function run() {
  try {
    console.log('Waiting for Chrome...');
    await waitForChrome();
    console.log('Chrome ready!');

    // Create a new target page
    const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?https://virp.pl`, { method: 'PUT' });
    const target = await newTabRes.json();
    const wsUrl = target.webSocketDebuggerUrl;

    const ws = new WebSocket(wsUrl);

    let id = 1;
    const callbacks = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && callbacks.has(msg.id)) {
        const { resolve, reject } = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };

    await new Promise((resolve) => ws.onopen = resolve);

    function send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const msgId = id++;
        callbacks.set(msgId, { resolve, reject });
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('DOM.enable');
    await send('CSS.enable');
    await send('Runtime.enable');

    // High DPI for ultra-crisp screenshot
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1.5,
      mobile: false
    });

    // Helper to capture a screenshot
    async function capture(url, filename, setupFn = null, waitMs = 3000) {
      console.log(`Navigating to ${url}...`);
      await send('Page.navigate', { url });
      await new Promise(r => setTimeout(r, waitMs));

      // Dismiss cookie banner & setup view
      await send('Runtime.evaluate', {
        expression: `
          (() => {
            const cb = document.getElementById('cookie-banner');
            if (cb) cb.remove();
            try { localStorage.setItem('virp_consent_cookies', 'true'); } catch(e){}
          })()
        `
      });

      if (setupFn) {
        await send('Runtime.evaluate', { expression: setupFn });
        await new Promise(r => setTimeout(r, 1000));
      }

      console.log(`Taking screenshot for ${filename}...`);
      const { data } = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
      });

      const buffer = Buffer.from(data, 'base64');
      fs.writeFileSync(filename, buffer);
      console.log(`Saved: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
    }

    // Screenshot 1: Strona główna - góra (Hero)
    await capture('https://virp.pl', 'screenshot_1_glowna_hero.png', null, 3500);

    // Screenshot 2: Sekcja Streamerzy (Dedykowana podstrona /streamerzy)
    await capture('https://virp.pl/streamerzy', 'screenshot_2_streamerzy.png', null, 3500);

    // Screenshot 3: Sekcja RP Toolkit na stronie głównej (#toolkit)
    await capture('https://virp.pl', 'screenshot_3_rp_toolkit_glowna.png', `
      (() => {
        const sec = document.getElementById('toolkit');
        if (sec) {
          sec.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()
    `, 2500);

    // Screenshot 4: Sekcja RP Toolkit - pełne narzędzie (/toolkit)
    await capture('https://virp.pl/toolkit', 'screenshot_4_rp_toolkit_strona.png', null, 3500);

    console.log('All screenshots taken successfully!');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

run();

