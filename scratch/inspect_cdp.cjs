const fs = require('fs');

async function main() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('localhost:5173'));
  if (!pageTab) {
    console.error('No localhost:5173 tab found!');
    return;
  }
  console.log('Connecting to:', pageTab.webSocketDebuggerUrl);

  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

  let idCounter = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        reject(msg.error);
      } else {
        resolve(msg.result);
      }
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = idCounter++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.onopen = async () => {
    try {
      console.log('Connected to Chrome DevTools Protocol!');

      // Evaluate page DOM
      const evalRes = await send('Runtime.evaluate', {
        expression: `
          (function() {
            const el = document.querySelector('.hero-title-wrapper');
            const svgText = document.querySelectorAll('.fire-char-svg text');
            const root = document.querySelector('.fire-traced-title-root');
            const main = document.querySelector('.cinematic-main');
            const exp = document.querySelector('.cinematic-experience');
            return {
              window: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                scrollY: window.scrollY
              },
              heroTitleWrapper: el ? {
                rect: el.getBoundingClientRect(),
                top: window.getComputedStyle(el).top,
                opacity: window.getComputedStyle(el).opacity,
                visibility: window.getComputedStyle(el).visibility,
                display: window.getComputedStyle(el).display,
                zIndex: window.getComputedStyle(el).zIndex,
                innerHTML: el.innerHTML.slice(0, 300)
              } : null,
              fireRoot: root ? {
                classes: root.className,
                rect: root.getBoundingClientRect()
              } : null,
              cinematicExperience: exp ? exp.getBoundingClientRect() : null,
              svgTextsCount: svgText.length,
              svgTexts: Array.from(svgText).map(t => ({
                text: t.textContent,
                opacity: window.getComputedStyle(t).opacity,
                rect: t.getBoundingClientRect()
              }))
            };
          })()
        `,
        returnByValue: true
      });

      console.log('DOM Evaluation Result:', JSON.stringify(evalRes.result.value, null, 2));

      // Capture screenshot
      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
      });

      fs.writeFileSync('scratch/cdp_screenshot.png', Buffer.from(shot.data, 'base64'));
      console.log('Screenshot saved to scratch/cdp_screenshot.png');

      ws.close();
      process.exit(0);
    } catch (err) {
      console.error('Error during CDP interaction:', err);
      ws.close();
      process.exit(1);
    }
  };

  ws.onerror = (err) => {
    console.error('WS Error:', err);
    process.exit(1);
  };
}

main();
