# SessionHop ![License MIT](https://img.shields.io/badge/license-MIT-green) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4)

**One-Click Account Switcher** — the power to manage multiple accounts across all sites, in one click. A Chrome extension that hops between logins by saving and restoring cookies, built for people who juggle work/personal accounts or test/prod environments without constant logging in and out.



## Features

- **Cookie-name targeting** — pick exactly which cookies to manage per site (usually just the login ones), so analytics and tracking cookies don't pollute switches. Includes a smart suggestion that pre-selects likely auth cookies (HttpOnly, or names like `sess`, `auth`, `token`, `sid`).
- **Wildcard scopes** — one domain pattern decides how accounts are grouped and which cookies are captured: `example.com` (whole site), `www-d.example.com` (single host, for test vs. prod), `*.example.com`, `*-d.example.com`.
- **One-click switch** — clears only the managed cookies, restores the target account's, and reloads the tab. Untouched cookies stay put.
- **Active-account detection** — compares live cookies and highlights which saved account you're currently logged in as.
- **Collapsible account rail** — quick-switch sidebar with search; avatars when collapsed, names when expanded.
- **Management page** — a full tab to add scopes, edit cookie groups, rename/delete profiles, and import/export as JSON.
- **Local only** — everything lives in `chrome.storage.local`; nothing is ever sent to a server.

## Installation

### From source

```bash
npm install
npm run build      # output in dist/
```

Then load it in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right)
3. Click **Load unpacked** and select the `dist/` folder

For development with hot reload:

```bash
npm run dev
```

## Usage

1. Log in to a site with account A, open the popup, give it a name, and save.
2. Log out, log in as account B, and save it too.
3. Click any account in the left rail to switch — the page reloads into that session.

Use the ⚙ Cookie badge to choose which cookies count as the login state, and the management tab (🗂 / Settings) to organize scopes and profiles.

## How it works

The extension reads cookies with the `chrome.cookies` API (including `HttpOnly`). Each **scope** is a wildcard domain pattern that serves as both the account group key and the cookie filter. Saving an account stores the managed cookies; switching clears those same cookies and writes back the target account's set, leaving everything else alone.

## Tech stack

- Manifest V3 · `chrome.cookies` / `chrome.storage`
- React 18 + Vite 5 + [@crxjs/vite-plugin](https://crxjs.dev/)
- Tailwind CSS v4 + shadcn-style components (Radix, cva, lucide-react)

## Limitations

- Only handles cookies. Sites that keep their token in `localStorage` (some SPAs) may not switch cleanly.
- Cookies bound to device/IP may be rejected by the server when imported on another machine.
- A few restricted cookies (e.g. `__Host-` prefixed) can occasionally fail to write back; the popup reports how many failed.

## Privacy

All account data is stored locally via `chrome.storage.local` and never transmitted. Exported JSON files contain login credentials — treat them like passwords and don't share them with anyone you don't trust.

## License

MIT
