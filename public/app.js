/* ═══════════════════════════════════════════════════════════
   ServerAlarm — Frontend
   ═══════════════════════════════════════════════════════════ */

(() => {
    'use strict';

    const $ = (s) => document.querySelector(s);
    const urlInput = $('#urlInput');
    const watchBtn = $('#watchBtn');
    const errorHint = $('#errorHint');
    const watchList = $('#watchList');
    const watchCount = $('#watchCount');
    const navStatus = $('#navStatus');
    const liveDot = document.querySelector('.live-dot');
    const alarmOverlay = $('#alarmOverlay');
    const alarmUrl = $('#alarmUrl');
    const dismissBtn = $('#dismissBtn');

    let watches = [];
    let alarmAudioCtx = null;
    let alarmOsc = null;
    let alarmInterval = null;

    // ── API ─────────────────────────────────────────────────

    async function api(method, path, body) {
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(path, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    }

    // ── Load ────────────────────────────────────────────────

    async function loadWatches() {
        try {
            watches = await api('GET', '/api/watches');
            render();
        } catch (err) {
            showMsg(err.message, 'error');
        }
    }

    // ── Render ──────────────────────────────────────────────

    function render() {
        watchCount.textContent = watches.length;
        updateNav();

        if (watches.length === 0) {
            watchList.innerHTML = `
        <div class="empty" id="emptyState">
          <p>No active watches</p>
          <span>Add a URL above to begin monitoring.</span>
        </div>`;
            return;
        }

        watchList.innerHTML = '';
        for (const w of watches) {
            watchList.appendChild(card(w));
        }
    }

    function card(w) {
        const el = document.createElement('div');
        el.className = 'watch-card';
        el.dataset.id = w.id;

        const st = w.status || 'checking';
        const label = st === 'checking' ? 'Checking' : st === 'down' ? 'Down' : 'Up';
        const elapsed = w.last_checked ? timeSince(w.last_checked) : '—';

        el.innerHTML = `
      <div class="status-indicator ${st}"></div>
      <div class="card-body">
        <div class="card-url" title="${esc(w.url)}">${esc(w.url)}</div>
        <div class="card-meta">
          <span>${label}</span>
          <span>${elapsed}</span>
          <span>${w.consecutive || 0}/2 passes</span>
        </div>
      </div>
      <button class="btn-remove" title="Stop watching" data-id="${w.id}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>`;

        el.querySelector('.btn-remove').addEventListener('click', () => removeWatch(w.id));
        return el;
    }

    function updateNav() {
        if (watches.length > 0) {
            navStatus.textContent = `Monitoring ${watches.length} URL${watches.length > 1 ? 's' : ''}`;
            liveDot.classList.add('active');
        } else {
            navStatus.textContent = 'Idle';
            liveDot.classList.remove('active');
        }
    }

    // ── Add Watch ───────────────────────────────────────────

    async function addWatch() {
        const url = urlInput.value.trim();
        if (!url) { showMsg('Enter a URL.', 'error'); return; }

        watchBtn.disabled = true;
        clearMsg();

        try {
            const w = await api('POST', '/api/watch', { url });
            watches.unshift(w);
            render();
            urlInput.value = '';
            showMsg('Watching started.', 'success');
        } catch (err) {
            showMsg(err.message, 'error');
        } finally {
            watchBtn.disabled = false;
        }
    }

    // ── Remove Watch ────────────────────────────────────────

    async function removeWatch(id) {
        try {
            await api('DELETE', `/api/watch/${id}`);
            watches = watches.filter(w => w.id !== id);
            render();
        } catch (err) {
            showMsg(err.message, 'error');
        }
    }

    // ── SSE ─────────────────────────────────────────────────

    function connectSSE() {
        const es = new EventSource('/api/events');

        es.addEventListener('status-update', (e) => {
            const d = JSON.parse(e.data);
            const i = watches.findIndex(w => w.id === d.id);
            if (i !== -1) { watches[i] = { ...watches[i], ...d }; render(); }
        });

        es.addEventListener('alarm', (e) => {
            const d = JSON.parse(e.data);
            triggerAlarm(d.url);
        });

        es.addEventListener('watch-removed', (e) => {
            const d = JSON.parse(e.data);
            watches = watches.filter(w => w.id !== d.id);
            render();
        });

        es.addEventListener('error', () => {
            console.warn('SSE reconnecting…');
        });
    }

    // ── Alarm Sound ─────────────────────────────────────────

    function playAlarm() {
        try {
            alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
            alarmOsc = alarmAudioCtx.createOscillator();
            const gain = alarmAudioCtx.createGain();

            alarmOsc.type = 'sawtooth';
            alarmOsc.frequency.setValueAtTime(440, alarmAudioCtx.currentTime);
            gain.gain.setValueAtTime(0.25, alarmAudioCtx.currentTime);

            alarmOsc.connect(gain);
            gain.connect(alarmAudioCtx.destination);
            alarmOsc.start();

            let up = true;
            alarmInterval = setInterval(() => {
                const t = alarmAudioCtx.currentTime;
                alarmOsc.frequency.linearRampToValueAtTime(up ? 880 : 440, t + 0.5);
                up = !up;
            }, 500);
        } catch { }
    }

    function stopAlarm() {
        if (alarmInterval) { clearInterval(alarmInterval); alarmInterval = null; }
        if (alarmOsc) { try { alarmOsc.stop(); } catch { } alarmOsc = null; }
        if (alarmAudioCtx) { try { alarmAudioCtx.close(); } catch { } alarmAudioCtx = null; }
    }

    function triggerAlarm(url) {
        alarmUrl.textContent = url;
        alarmOverlay.classList.add('active');
        playAlarm();
    }

    function dismissAlarm() {
        alarmOverlay.classList.remove('active');
        stopAlarm();
    }

    // ── Helpers ─────────────────────────────────────────────

    function showMsg(m, t) { errorHint.textContent = m; errorHint.className = `form-msg ${t}`; }
    function clearMsg() { errorHint.textContent = ''; errorHint.className = 'form-msg'; }
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    function timeSince(ds) {
        const s = Math.floor((Date.now() - new Date(ds + 'Z').getTime()) / 1000);
        if (s < 10) return 'just now';
        if (s < 60) return s + 's ago';
        const m = Math.floor(s / 60);
        if (m < 60) return m + 'm ago';
        const h = Math.floor(m / 60);
        return h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ago';
    }

    // Auto-refresh timestamps
    setInterval(() => {
        document.querySelectorAll('.watch-card').forEach(c => {
            const w = watches.find(w => w.id === c.dataset.id);
            if (w && w.last_checked) {
                const spans = c.querySelectorAll('.card-meta span');
                if (spans[1]) spans[1].textContent = timeSince(w.last_checked);
            }
        });
    }, 5000);

    // ── Events ──────────────────────────────────────────────

    watchBtn.addEventListener('click', addWatch);
    urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addWatch(); });
    dismissBtn.addEventListener('click', dismissAlarm);

    // ── Init ────────────────────────────────────────────────

    loadWatches();
    connectSSE();
})();
