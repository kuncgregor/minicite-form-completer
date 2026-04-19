const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const TMP_DIR = path.join(ROOT_DIR, 'tmp');
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const activeRuns = new Map();

app.use(express.json());
app.use(express.static(path.join(ROOT_DIR, 'web')));

function readBaseConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        throw new Error('Missing config.json in project root.');
    }

    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function sanitizeEmails(emails) {
    if (!Array.isArray(emails)) {
        return [];
    }

    return emails
        .filter((email) => typeof email === 'string')
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
}

function cleanupOldTmpFiles() {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const now = Date.now();
    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;

    for (const name of fs.readdirSync(TMP_DIR)) {
        if (!name.startsWith('runtime-config-') || !name.endsWith('.json')) {
            continue;
        }

        const fullPath = path.join(TMP_DIR, name);
        try {
            const stat = fs.statSync(fullPath);
            if (now - stat.mtimeMs > maxAgeMs) {
                fs.unlinkSync(fullPath);
            }
        } catch {
            // Ignore cleanup errors for stale temp files.
        }
    }
}

function removeActiveRun(pid) {
    const run = activeRuns.get(pid);
    if (!run) {
        return;
    }

    activeRuns.delete(pid);

    if (run.runtimeConfigPath && fs.existsSync(run.runtimeConfigPath)) {
        try {
            fs.unlinkSync(run.runtimeConfigPath);
        } catch {
            // Ignore cleanup errors.
        }
    }
}

function stopRunByPid(pid) {
    // On Unix, detached children are process-group leaders.
    try {
        process.kill(-pid, 'SIGTERM');
        return true;
    } catch {
        try {
            process.kill(pid, 'SIGTERM');
            return true;
        } catch {
            return false;
        }
    }
}

app.post('/api/prepare', (req, res) => {
    try {
        if (activeRuns.size > 0) {
            return res.status(409).json({
                ok: false,
                error: 'An automation run is already active. Finish it before starting a new one.'
            });
        }

        const emails = sanitizeEmails(req.body?.emails);
        if (emails.length === 0) {
            return res.status(400).json({ ok: false, error: 'At least one email is required.' });
        }

        const baseConfig = readBaseConfig();
        cleanupOldTmpFiles();

        const runtimeConfig = {
            ...baseConfig,
            emails,
            headless: false,
            manualSubmit: true,
            closeBrowserAfterManualSubmit: false
        };

        const runtimeConfigPath = path.join(TMP_DIR, `runtime-config-${Date.now()}.json`);
        fs.writeFileSync(runtimeConfigPath, JSON.stringify(runtimeConfig, null, 2));

        const child = spawn(process.execPath, ['automation.js', '--config', runtimeConfigPath], {
            cwd: ROOT_DIR,
            detached: true,
            stdio: 'ignore'
        });

        activeRuns.set(child.pid, {
            pid: child.pid,
            runtimeConfigPath,
            startedAt: Date.now()
        });

        child.on('exit', () => {
            removeActiveRun(child.pid);
        });

        child.unref();

        return res.json({
            ok: true,
            tabCount: emails.length,
            message: 'Browser tabs are being prepared now.'
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
});

app.get('/api/status', (_req, res) => {
    return res.json({
        ok: true,
        hasActiveRun: activeRuns.size > 0,
        activeRuns: activeRuns.size
    });
});

app.post('/api/finish', (_req, res) => {
    const pids = [...activeRuns.keys()];
    if (pids.length === 0) {
        return res.json({
            ok: true,
            stopped: 0,
            message: 'No active automation run to stop.'
        });
    }

    let stopped = 0;
    for (const pid of pids) {
        if (stopRunByPid(pid)) {
            stopped += 1;
        }
        removeActiveRun(pid);
    }

    return res.json({
        ok: true,
        stopped,
        message: stopped > 0
            ? 'Stop signal sent. Browser tabs should close in a moment.'
            : 'Could not stop active run(s). They may have already exited.'
    });
});

app.listen(PORT, () => {
    console.log(`GUI available at http://localhost:${PORT}`);
});
