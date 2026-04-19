const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const TMP_DIR = path.join(ROOT_DIR, 'tmp');
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');

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

app.post('/api/prepare', (req, res) => {
    try {
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

app.listen(PORT, () => {
    console.log(`GUI available at http://localhost:${PORT}`);
});
