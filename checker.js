/**
 * URL Checker — polls watched URLs and fires alarm events via SSE.
 */

const {
    getActiveWatches,
    updateWatchStatus,
    deleteWatch,
    expireOldWatches,
} = require('./db');

// SSE clients — each is a Response object
const sseClients = new Set();

function addSSEClient(res) {
    sseClients.add(res);
    res.on('close', () => sseClients.delete(res));
}

function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        client.write(payload);
    }
}

// ─── Core check logic ──────────────────────────────────────

async function checkUrl(url, timeoutMs = 10000) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            redirect: 'follow',
            headers: { 'User-Agent': 'ServerStatusAlarm/1.0' },
        });

        clearTimeout(timer);

        // 200-399 = up
        return res.status >= 200 && res.status < 400;
    } catch {
        return false;
    }
}

async function runCheckCycle() {
    // Clean expired watches first
    expireOldWatches.run();

    const watches = getActiveWatches.all();

    for (const watch of watches) {
        const isUp = await checkUrl(watch.url);

        if (isUp) {
            const newConsec = watch.consecutive + 1;
            updateWatchStatus.run('checking', newConsec, watch.id);

            if (newConsec >= 2) {
                // 🎉 Server is UP — fire alarm!
                updateWatchStatus.run('up', newConsec, watch.id);

                broadcast('alarm', {
                    id: watch.id,
                    url: watch.url,
                    message: `🚨 ${watch.url} is back UP!`,
                });

                // Auto-delete: one-shot, job is done
                setTimeout(() => {
                    deleteWatch.run(watch.id);
                    broadcast('watch-removed', { id: watch.id });
                }, 5000);
            } else {
                // First success — update but keep watching
                broadcast('status-update', {
                    id: watch.id,
                    url: watch.url,
                    status: 'checking',
                    consecutive: newConsec,
                    last_checked: new Date().toISOString(),
                });
            }
        } else {
            // Down — reset consecutive counter
            updateWatchStatus.run('down', 0, watch.id);

            broadcast('status-update', {
                id: watch.id,
                url: watch.url,
                status: 'down',
                consecutive: 0,
                last_checked: new Date().toISOString(),
            });
        }
    }
}

// ─── Start the polling loop ─────────────────────────────────

let checkerInterval = null;

function startChecker(intervalMs = 30000) {
    if (checkerInterval) return;

    console.log(`🔄 Checker started (every ${intervalMs / 1000}s)`);

    // Run immediately, then on interval
    runCheckCycle();
    checkerInterval = setInterval(runCheckCycle, intervalMs);
}

function stopChecker() {
    if (checkerInterval) {
        clearInterval(checkerInterval);
        checkerInterval = null;
    }
}

module.exports = {
    startChecker,
    stopChecker,
    addSSEClient,
    broadcast,
};
