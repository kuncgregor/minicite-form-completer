# Urnik Automation

Simple automation project with two modes:
- GUI mode 
- CLI mode (run once from terminal)

## 1. Install

Run in this folder:

```bash
npm install
```

## 2. Configure

Create `config.json` from `config.example.json` and fill your real values.

Set multiple emails in the `emails` array. The script prepares one browser tab per email.

Configure the website link in the `url` field of `config.json`.

## 3. GUI mode

Start the local GUI:

```bash
npm run gui
```

Open in browser:

```text
http://localhost:3000
```

## 4. CLI mode

Run once from terminal:

```bash
npm run run-once
```

