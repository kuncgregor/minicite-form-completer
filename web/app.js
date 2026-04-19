const STORAGE_KEY = 'urnik-automation-emails';

const emailsInput = document.getElementById('emailsInput');
const saveBtn = document.getElementById('saveBtn');
const runBtn = document.getElementById('runBtn');
const finishBtn = document.getElementById('finishBtn');
const statusEl = document.getElementById('status');

const statusBaseClasses = ['mt-4', 'rounded-md', 'border', 'bg-white', 'px-3', 'py-2', 'text-sm'];
const statusNeutralClasses = ['border-zinc-300', 'text-zinc-800'];
const statusSuccessClasses = ['border-zinc-900', 'text-zinc-900'];
const statusErrorClasses = ['border-zinc-900', 'text-zinc-900'];

function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = '';
    statusEl.classList.add(...statusBaseClasses);

    if (type === 'success') {
        statusEl.classList.add(...statusSuccessClasses);
        return;
    }

    if (type === 'error') {
        statusEl.classList.add(...statusErrorClasses);
        return;
    }

    statusEl.classList.add(...statusNeutralClasses);
}

function parseEmails(text) {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function loadStoredEmails() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return;
    }

    try {
        const emails = JSON.parse(raw);
        if (Array.isArray(emails)) {
            emailsInput.value = emails.join('\n');
            setStatus(`Nalozenih emailov: ${emails.length}`, 'success');
        }
    } catch {
        setStatus('Shranjeni podatki so bili neveljavni in so ignorirani.', 'error');
    }
}

function setButtonsState({ isPreparing = false, hasActiveRun = false } = {}) {
    runBtn.disabled = isPreparing || hasActiveRun;
    finishBtn.disabled = isPreparing || !hasActiveRun;
}

function saveEmails() {
    const emails = parseEmails(emailsInput.value);
    if (emails.length === 0) {
        setStatus('Dodaj vsaj en email.', 'error');
        return;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(emails));
    setStatus(`Shranjeno ${emails.length} emailov v tem brskalniku.`, 'success');
}

async function runPreparation() {
    const emails = parseEmails(emailsInput.value);
    if (emails.length === 0) {
        setStatus('Dodaj vsaj en email pred zagonom.', 'error');
        return;
    }

    saveEmails();

    setButtonsState({ isPreparing: true, hasActiveRun: false });
    setStatus('Pripravljam tab-e ...');

    try {
        const response = await fetch('/api/prepare', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ emails })
        });

        const payload = await response.json();
        if (!response.ok || !payload.ok) {
            throw new Error(payload.error || 'Napaka pri pripravi tabov.');
        }

        setStatus(`Koncano. Pripravljam ${payload.tabCount} tab-ov v browserju. Ko oddas vse, klikni Zakljuci.`, 'success');
        setButtonsState({ hasActiveRun: true });
    } catch (error) {
        setStatus(`Napaka: ${error.message}`, 'error');
        await syncRunState();
    }
}

async function finishPreparation() {
    finishBtn.disabled = true;
    setStatus('Zakljucujem proces in zapiram tabe ...');

    try {
        const response = await fetch('/api/finish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const payload = await response.json();
        if (!response.ok || !payload.ok) {
            throw new Error(payload.error || 'Napaka pri zakljucku procesa.');
        }

        setStatus(payload.message || 'Proces je zakljucen.', 'success');
        setButtonsState({ hasActiveRun: false });
    } catch (error) {
        setStatus(`Napaka: ${error.message}`, 'error');
        await syncRunState();
    }
}

async function syncRunState() {
    try {
        const response = await fetch('/api/status');
        const payload = await response.json();
        if (response.ok && payload.ok) {
            setButtonsState({ hasActiveRun: payload.hasActiveRun });
            return;
        }
    } catch {
        // Keep current state when status endpoint is unavailable.
    }

    setButtonsState({ hasActiveRun: false });
}

saveBtn.addEventListener('click', saveEmails);
runBtn.addEventListener('click', runPreparation);
finishBtn.addEventListener('click', finishPreparation);

loadStoredEmails();
syncRunState();
