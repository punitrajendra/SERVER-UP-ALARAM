const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const {
    addWatch,
    getActiveWatches,
    countActiveWatches,
    deleteWatch,
} = require('./db');
const { validateUrl } = require('./ssrf');
const { startChecker, addSSEClient } = require('./checker');

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_WATCHES = 5;

// ─── Middleware ──────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ─────────────────────────────────────────────

// Add a new watch
app.post('/api/watch', (req, res) => {
    const { url } = req.body;

    // Validate URL & SSRF check
    const check = validateUrl(url);
    if (!check.valid) {
        return res.status(400).json({ error: check.reason });
    }

    // Enforce watch limit
    const { count } = countActiveWatches.get();
    if (count >= MAX_WATCHES) {
        return res.status(429).json({
            error: `Maximum ${MAX_WATCHES} active watches allowed. Remove one first.`,
        });
    }

    const id = uuidv4();
    addWatch.run(id, check.url);

    const watch = { id, url: check.url, status: 'checking', consecutive: 0 };
    res.status(201).json(watch);
});

// List all active watches
app.get('/api/watches', (req, res) => {
    const watches = getActiveWatches.all();
    res.json(watches);
});

// Delete a watch
app.delete('/api/watch/:id', (req, res) => {
    const result = deleteWatch.run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Watch not found' });
    }
    res.json({ success: true });
});

// ─── SSE Endpoint ───────────────────────────────────────────

app.get('/api/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    // Send initial heartbeat
    res.write('event: connected\ndata: {"message":"SSE connected"}\n\n');

    addSSEClient(res);

    // Keep-alive ping every 30s to prevent timeout
    const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    req.on('close', () => {
        clearInterval(keepAlive);
    });
});

// ─── SPA fallback ───────────────────────────────────────────

app.get('{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start ──────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`\n  ⚡ Server Status Alarm running at http://localhost:${PORT}\n`);
    startChecker(30000);
});
