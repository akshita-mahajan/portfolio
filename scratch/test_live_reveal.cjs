const fs = require('fs');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('localhost:5173'));
  if (!pageTab) {
    console.error('No localhost:5173 tab found!');
    process.exit(1);
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
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
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
      console.log('Connected! Reloading page from clean state...');
      await send('Page.reload');

      // 1. Initial state at 500ms
      await sleep(500);
      let shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/live_01_initial_clean.png', Buffer.from(shot.data, 'base64'));
      console.log('Captured live_01_initial_clean.png (t=0.5s)');

      // 2. Letter 'A' fire tracing at 1.8s
      await sleep(1300);
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/live_02_tracing_first_a.png', Buffer.from(shot.data, 'base64'));
      console.log('Captured live_02_tracing_first_a.png (t=1.8s)');

      // 3. Middle letters tracing at 3.0s
      await sleep(1200);
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/live_03_tracing_mid_name.png', Buffer.from(shot.data, 'base64'));
      console.log('Captured live_03_tracing_mid_name.png (t=3.0s)');

      // 4. Settling state at 4.8s
      await sleep(1800);
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/live_04_settling_mahajan.png', Buffer.from(shot.data, 'base64'));
      console.log('Captured live_04_settling_mahajan.png (t=4.8s)');

      // 5. Settled complete state at 6.0s
      await sleep(1200);
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/live_05_fully_settled.png', Buffer.from(shot.data, 'base64'));
      console.log('Captured live_05_fully_settled.png (t=6.0s)');

      // 6. Critical 10-Second Wait: t=16.0s
      console.log('Waiting 10 full seconds to verify permanence (no repeats)...');
      await sleep(10000);
      shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('scratch/live_06_after_10s_permanent.png', Buffer.from(shot.data, 'base64'));
      console.log('Captured live_06_after_10s_permanent.png (t=16.0s)');

      // Check DOM state
      const checkRes = await send('Runtime.evaluate', {
        expression: `
          (function() {
            const exp = document.querySelector('.cinematic-experience');
            const mahajan = document.querySelector('.word-mahajan');
            const descriptor = document.querySelector('.hero-sub-descriptor');
            const cta = document.querySelector('.hero-explore-cta');
            return {
              isSettled: exp ? exp.classList.contains('stage-settled') : false,
              mahajanVisible: mahajan ? mahajan.classList.contains('mahajan-emerged') : false,
              descriptorVisible: descriptor ? descriptor.classList.contains('descriptor-visible') : false,
              ctaVisible: cta ? cta.classList.contains('cta-visible') : false
            };
          })()
        `,
        returnByValue: true
      });
      console.log('Settlement state check:', JSON.stringify(checkRes.result.value, null, 2));

      ws.close();
      process.exit(0);
    } catch (err) {
      console.error('Error during live test:', err);
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
