# Minicite form completer

Simple automation project with two modes:
- GUI mode 
- CLI mode 

## 1. Install

Run in this folder:

```bash
npm install
```

## 3. GUI mode

Start the local GUI:

```bash
npm run gui
```

Open in browser:

```text
http://localhost:3000
```

GUI flow:
1. Paste emails (one per line).
2. Click `Shrani emaile`.
3. Click `Izpolni forme za oddajo`.
4. Tabs will open and be pre-filled.
5. Manually solve CAPTCHA and submit in each tab.
6. Click `Zakljuci in zapri tabe` in GUI to stop the process and close tabs.

Notes:
- Only one active automation run is allowed at a time.
- If a run is already active, starting a new one is blocked until you finish the current run.
- GUI remembers emails in browser local storage.

## 4. CLI mode

### Configure

Create `config.json` from `config.example.json` and fill your real values.

Important fields:
- `url`: target form page
- `emails`: list of emails; one browser tab is prepared for each email
- `emailSelector`: CSS selector for email input
- `buttonSelector`: CSS selector for daily option / choice button
- `submitSelector`: CSS selector for final submit button (used only when `manualSubmit` is `false`)
- `manualSubmit`: keep `true` when you solve CAPTCHA and click submit manually
- `closeBrowserAfterManualSubmit`: in CLI mode, browser closes after Enter when `true`; in GUI flow use the finish button

### Run once from terminal:

```bash
npm run run-once
```
CLI behavior:
- When `manualSubmit` is `true`, tabs are prepared and script waits.
- Stop with `Ctrl+C`, or use `closeBrowserAfterManualSubmit: true` and press Enter when done.

