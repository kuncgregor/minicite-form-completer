const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { chromium } = require('playwright');

function getConfigPathFromArgs() {
    const index = process.argv.indexOf('--config');
    if (index === -1 || !process.argv[index + 1]) {
        return path.join(__dirname, 'config.json');
    }

    return path.resolve(process.argv[index + 1]);
}

function loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
        throw new Error('Missing config.json. Copy config.example.json to config.json and edit values.');
    }

    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);

    const required = ['url', 'emailSelector', 'buttonSelector'];
    for (const key of required) {
        if (!config[key] || typeof config[key] !== 'string') {
            throw new Error(`Invalid or missing config field: ${key}`);
        }
    }

    const emailsFromArray = Array.isArray(config.emails)
        ? config.emails.filter((value) => typeof value === 'string' && value.trim().length > 0)
        : [];
    const fallbackEmail = typeof config.email === 'string' && config.email.trim().length > 0
        ? [config.email.trim()]
        : [];
    const emails = emailsFromArray.length > 0 ? emailsFromArray : fallbackEmail;

    if (emails.length === 0) {
        throw new Error('Missing emails. Add "emails" array (preferred) or "email" string in config.json.');
    }

    return {
        headless: false,
        timeoutMs: 30000,
        screenshotOnDone: true,
        manualSubmit: true,
        closeBrowserAfterManualSubmit: false,
        emails,
        ...config
    };
}

function waitForEnter(message) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        rl.question(message, () => {
            rl.close();
            resolve();
        });
    });
}

function waitForTerminationSignal() {
    return new Promise((resolve) => {
        const keepAliveTimer = setInterval(() => {
            // Keep Node event loop active while user submits forms manually.
        }, 60 * 1000);

        const cleanup = () => {
            clearInterval(keepAliveTimer);
            process.off('SIGINT', onSignal);
            process.off('SIGTERM', onSignal);
            resolve();
        };

        const onSignal = () => {
            cleanup();
        };

        process.on('SIGINT', onSignal);
        process.on('SIGTERM', onSignal);
    });
}

async function run() {
    const configPath = getConfigPathFromArgs();
    const config = loadConfig(configPath);
    const browser = await chromium.launch({ headless: config.headless });

    try {
        const pages = [];

        for (const email of config.emails) {
            const page = await browser.newPage();
            pages.push(page);

            await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs });
            await page.waitForSelector(config.emailSelector, { timeout: config.timeoutMs });
            await page.fill(config.emailSelector, email);
            await page.waitForSelector(config.buttonSelector, { timeout: config.timeoutMs });
            await page.click(config.buttonSelector);

            if (!config.manualSubmit) {
                if (!config.submitSelector || typeof config.submitSelector !== 'string') {
                    throw new Error('manualSubmit=false requires submitSelector in config.json');
                }

                await page.waitForSelector(config.submitSelector, { timeout: config.timeoutMs });
                await page.click(config.submitSelector);

                if (config.successSelector) {
                    await page.waitForSelector(config.successSelector, { timeout: config.timeoutMs });
                }
            }

            console.log(`Prepared tab for: ${email}`);
        }

        if (pages.length > 0) {
            await pages[0].bringToFront();
        }

        // if (config.screenshotOnDone) {
        //     const screenshotsDir = path.join(__dirname, 'screenshots');
        //     fs.mkdirSync(screenshotsDir, { recursive: true });
        //     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        //     for (let i = 0; i < pages.length; i += 1) {
        //         const screenshotPath = path.join(screenshotsDir, `prepared-${i + 1}-${timestamp}.png`);
        //         await pages[i].screenshot({ path: screenshotPath, fullPage: true });
        //         console.log(`Saved screenshot: ${screenshotPath}`);
        //     }
        // }

        if (config.manualSubmit) {
            console.log('All tabs are prepared. Solve CAPTCHA and click submit manually in each tab.');
            if (config.closeBrowserAfterManualSubmit) {
                await waitForEnter('Press Enter after you finish manual submits to close browser... ');
            } else {
                console.log('Browser will stay open. Stop this script with Ctrl+C when done.');
                await waitForTerminationSignal();
            }
        } else {
            console.log('Automation run completed successfully.');
        }
    } finally {
        await browser.close();
    }
}

run().catch((error) => {
    console.error('Automation run failed:', error.message);
    process.exit(1);
});
