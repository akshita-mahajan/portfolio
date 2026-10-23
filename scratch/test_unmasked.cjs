async function test() {
  const tabsRes = await fetch('http://127.0.0.1:9222/json');
  const tabs = await tabsRes.json();
  const pageTab = tabs.find(t => t.url.includes('localhost:5173'));

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
    // Unmask and show first letter
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          const gs = document.querySelectorAll('.fire-char-box svg g');
          gs.forEach(g => {
            g.style.opacity = '1';
            g.removeAttribute('mask');
          });
          const m = document.querySelector('.word-mahajan');
          if (m) {
            m.classList.remove('mahajan-hidden');
            m.classList.add('mahajan-emerged');
          }
          return 'done';
        })()
      `
    });

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const fs = require('fs');
    fs.writeFileSync('scratch/test_unmasked.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved scratch/test_unmasked.png');
    ws.close();
    process.exit(0);
  };
}

test();
