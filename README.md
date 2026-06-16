# Vesting — Phase 1

**Your practice. Your clients. Secured.**

A complete, offline-first practice management tool for South African estate agents. Built with vanilla HTML, CSS and JavaScript — no frameworks, no build step, no backend. By MD Works, Durban.

---

## What this is

Phase 1 is a free, standalone tool any agent can open in a browser and start using immediately. No login, no signup, no server. Every byte of data lives encrypted on the agent's own device. It installs as a PWA and works fully offline.

Covers the full agent workflow: leads → properties → inspections → diary, plus a separate contacts book for attorneys, contractors and colleagues.

---

## File structure

```
vesting/
├── index.html              Dashboard
├── leads.html               Lead list, search, filter
├── lead-form.html           New / edit lead
├── contacts.html             Contact list, search, filter
├── contact-form.html         New / edit contact
├── properties.html           Property grid, search, filter
├── property-form.html        New / edit property — 8 sections, photos, features
├── inspections.html          Inspection list
├── inspection-form.html      Checklist, meters, signatures, PDF report
├── diary.html                 Google Calendar embed + quick event creator
├── settings.html             Profile, encryption, export/backup, help links
├── help.html                  Full 12-section user guide
├── manifest.json              PWA manifest
├── sw.js                       Cache-first service worker
│
├── css/
│   └── style.css              Complete MD Works design system
│
├── js/
│   ├── db.js                  IndexedDB wrapper
│   ├── crypto.js               AES-256-GCM encryption layer
│   ├── app.js                  Shared utilities, nav, toast, WhatsApp, PDF generation
│   └── export.js               CSV export + JSON backup/restore
│
└── icons/
    ├── icon-192.png            PWA icon (supply your own — see below)
    └── icon-512.png            PWA icon (supply your own — see below)
```

Every page sits at the root — no subfolders for HTML. Every page loads scripts in the same order:

```html
<script src="js/db.js"></script>
<script src="js/crypto.js"></script>
<script src="js/app.js"></script>
<!-- + js/export.js on settings.html only -->
<!-- then the page's own inline <script> -->
```

---

## Deploying

1. Create two PNG icons — `icons/icon-192.png` (192×192) and `icons/icon-512.png` (512×512). A gold ✦ on the `#110e09` dark background matches the brand.
2. Upload the full folder structure above to a GitHub repository via the GitHub web editor or drag-and-drop (no CLI git, no npm, by design).
3. Connect the repo to Cloudflare Pages (free tier). It auto-deploys on every push.
4. Visit the live URL. First load redirects to `settings.html?setup=1` to create a passphrase.

PWA install requires HTTPS — Cloudflare Pages provides this automatically.

---

## Security model (POPIA)

All data is encrypted client-side before it ever touches IndexedDB.

- **Key derivation:** PBKDF2, 310,000 iterations, SHA-256 → 256-bit AES-GCM key.
- **Salt:** random 32 bytes, stored in IndexedDB settings — useless without the passphrase.
- **Encryption:** AES-256-GCM, fresh random IV per record.
- **Key storage:** the derived key lives only in memory (`crypto.js`) for the life of the tab. It is never written to disk.
- **Session persistence:** the passphrase itself is cached in `sessionStorage` so the agent isn't asked to unlock on every page navigation. `sessionStorage` is tab-scoped and memory-only — it disappears the moment the tab closes, which automatically re-locks the app. `App.init()` calls `Crypto.tryAutoUnlock()` on every page load to silently re-derive the key from this cached passphrase.
- **Verification:** a known plaintext token is encrypted and stored on first setup, so subsequent unlock attempts can confirm a passphrase is correct before exposing any real data.
- **Lock:** the Settings page has an explicit "Lock Session" button that clears the key from memory and the cached passphrase from `sessionStorage` immediately.
- **No recovery:** the passphrase cannot be recovered if lost. This is intentional — see `help.html#troubleshooting`.

This satisfies the POPIA principle that lead and client data is encrypted at rest, accessible only to the agent who holds the passphrase, and never transmitted anywhere (there is no server in Phase 1).

---

## Data model

Seven IndexedDB object stores, defined in `js/db.js`:

| Store | Purpose |
|---|---|
| `leads` | Buyers, renters, sellers — pipeline and follow-ups |
| `contacts` | Attorneys, contractors, colleagues — separate from leads |
| `properties` | Listings managed by the agent, sale and/or rental |
| `inspections` | Entry / exit / new-listing reports with checklist, meters, signatures |
| `photos` | Base64 image blobs, linked to a property or inspection |
| `events` | Local diary events |
| `settings` | Key-value store: agent profile, encryption salt, calendar email, last backup |

Full field-level schemas are documented inline in `js/db.js` and in the project brief.

---

## Backup and export

**CSV exports** (Leads, Contacts, Properties) are one-way, by design — they're for moving data into tools agents already use (Excel, Sheets, mail merges), not for re-importing into Vesting. There is currently no CSV import.

**Full JSON backup** is the only supported import/restore path. It exports the raw encrypted blobs from every store, including `photos`, and can only be restored on a device where the agent enters the same passphrase used at backup time. Restoring merges by record ID rather than wiping existing data.

> **Known limitation:** because property and inspection photos are base64-encoded inside the JSON backup, an agent with many high-resolution photos can generate a very large backup file. There is currently no warning shown before download. A future pass should either show an estimated file size before exporting, or split photos into a separate, optionally-included export. Flagged here so it isn't forgotten.

---

## PDF inspection reports

Generated via `App.generateInspectionPDF()` in `js/app.js`, using jsPDF (lazy-loaded from cdnjs on first use — no extra script tag needed). Produces a real, multi-page, openable `.pdf` file: branded header, inspection details, room-by-room checklist with colour-coded conditions, meter readings, embedded room/meter photos, embedded signatures, and a footer with page numbers throughout.

Signatures are captured in **black ink on a white canvas background**, matching how a signed document should look when printed or scanned — not the gold-on-dark in-app theme.

---

## Known platform fix — Android Chrome file inputs

Every hidden `<input type="file">` in the app (property photos, inspection room photos, inspection meter photos, backup restore) was originally hidden with `display: none`. Several Android Chrome versions silently block `.click()` on a fully `display: none` file input as a security measure. All four inputs now use a visually-hidden-but-present technique instead (clipped to 1px, absolutely positioned) so photo and file pickers work reliably on Android.

---

## What's deliberately not in Phase 1

These are Phase 2 / Phase 3 by design, per the master project brief — not omissions:

- No login or accounts (device-local only)
- No backend, API, or server of any kind
- No CSV import
- No multi-agent or agency features
- No public marketplace or lead capture from outside the app

---

*Vesting · by MD Works · Durban, South Africa*
*Phase 1 — Standalone Personal Workspace*
