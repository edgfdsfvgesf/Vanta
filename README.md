# Vanta

**A quieter corner of the web.** Vanta is a responsive browser-style dashboard for your shortcuts, games, saved pages, themes, and AI chat.

> Made by Mandy's Unblockers

## What Vanta includes

- A dark, responsive home page with animated transitions, themes, and adjustable text size
- A compact app launcher, address/search bar, tabs, bookmarks, and browsing history
- A game wall powered by the supplied Zen GS loader
- Optional device battery information when the browser supports it
- A Vanta AI chat panel backed by the local Node server and Groq
- Local profile preferences and user-uploaded fonts stored in the current browser

Vanta displays external websites in an embedded frame when the destination permits it. A website can refuse embedding, so Vanta cannot promise that every site will load in the page area.

## Run Vanta on your computer

1. Install Node.js 18 or newer.
2. Open this folder and run `start-vanta.bat`.
3. To enable Vanta AI, enter a **new** Groq API key in the hidden prompt. Press Enter without a key to run without AI.
4. Open [http://localhost:8000](http://localhost:8000).

The key is held in the local server process only. Vanta does not save it in the project files or browser storage. If the server stops, start it again and enter the key again. The key previously pasted into chat should be revoked and replaced.

You can also run `node server.mjs` to start without AI. The game loader and external pages need an internet connection.

## Publish the static site with GitHub Pages

The included GitHub Actions workflow publishes the front end from the `main` branch. In the repository, open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. Push to `main` or manually run the **Deploy Vanta to GitHub Pages** workflow. GitHub will show the published address in the Pages settings.

The workflow only copies the static site files into its Pages artifact. It does not publish the local server, API credentials, or local account data.

### What GitHub Pages can and cannot do

GitHub Pages serves static files; it does not run `server.mjs`, authenticate users, store game saves, or keep a database. The AI panel also needs a backend API, so it is available in the local Node setup but will need a separately hosted API to work on Pages. Do not place an API key in `app.js`, a public config file, the repository, or a hidden page: site visitors can inspect all browser code and network requests.

A private admin area and shared user accounts need a real backend with authentication, database access rules, and HTTPS. A secret URL or password-only page is not a safe substitute. Keep user data in that backend, never in this public repository or the Pages artifact. The Vanta frontend does not currently claim to provide global accounts or online-user presence.

## Custom fonts and preferences

Choose a preset text size in **Settings → Appearance**. Font files selected there are saved in IndexedDB in that browser on that device; they are not uploaded to the Vanta website. Use fonts you have permission to use and share.

## Project files

- `index.html`, `styles.css`, `app.js`, and `vanta-enhancements.js` — the Vanta interface
- `games-loader.html` — the supplied game loader
- `server.mjs` — local static server and optional Groq API bridge
- `start-vanta.bat` and `start-vanta.ps1` — Windows launchers
- `.github/workflows/pages.yml` — static GitHub Pages deployment

## Privacy and security

- Browser preferences, bookmarks, history, profile details, and uploaded fonts stay in that browser unless you clear its site data.
- The local Groq key is never sent to the front end; only chat messages are sent to Groq through the local server.
- Never commit `.env` files, API keys, generated account databases, or private user data.
- GitHub Pages is public hosting for static files. It is not private storage and cannot conceal a route from visitors.
