# GameDayInMyCity

**Every Game. Every City. Every Fan.** — the landing page for a local-first sports, gaming, and game-day platform.

This is a static website (HTML + CSS + vanilla JavaScript). No build step, no frameworks, no dependencies. You can open it directly in a browser or host it for free on GitHub Pages.

---

## 📁 Project structure

```
gamedayinmycity/
├── index.html          ← the page (structure/content)
├── css/
│   └── styles.css      ← all styling (colors, layout, responsive)
├── js/
│   └── main.js         ← interactivity (ticker, scores, tabs, Coach chat)
├── data/
│   └── states.js       ← Top States data — EDIT HERE to add/expand states
├── assets/
│   ├── logo.png        ← header logo
│   ├── coach.jpg       ← Coach portrait
│   └── favicon.png     ← browser tab icon
├── CNAME               ← custom domain (gamedayinmycity.com)
├── .gitignore
├── LICENSE
└── README.md
```

**Where to edit things**
- Text, sections, links → `index.html`
- Colors, fonts, spacing, sizes → `css/styles.css` (all the design "dials" live in the `:root { ... }` block at the very top)
- Animations and the demo logic (live scores, tabs, Coach answers, cities) → `js/main.js`
- **Top States content (the 10 states) → `data/states.js`** — this is the one file to edit to add or expand states
- Swap the logo or coach photo → drop new files into `assets/` using the same filenames

### ➕ Adding or editing a state

Open `data/states.js`. It contains one big list, `window.GDIMC_STATES`, with one `{ ... }` block per state. To add a state, copy an existing block, paste it, and change the values. The page rebuilds the States section automatically — no HTML or CSS edits needed. Each state looks like this:

```js
{
  ab: "NJ",                       // 2-letter abbreviation
  name: "New Jersey",
  tag: "Where it all started",    // tagline under the name
  coach: "Your home turf ...",    // one line in Coach's voice
  cities: ["Newark", "Atlantic City", "Toms River"],
  pro:     { n: "3", txt: "Giants & Jets at MetLife · Devils · Red Bulls" },
  college: "Rutgers, Seton Hall, Princeton",
  hs:      "NJSIAA — Toms River Little League world champs ...",
  bet:     { cls: "legal", label: "Legal · online + casino", note: "Murphy v. NCAA pioneer ..." },
  gaming:  "Atlantic City + a huge legal online-gaming market."
}
```

`bet.cls` controls the status color: `"legal"` (green), `"limited"` (amber), or `"no"` (red). **Verify betting status from a current source before publishing — it changes by state and over time.**

---

## ▶️ Run it locally

Easiest: just double-click `index.html` to open it in your browser.

If images or fonts act up when opening as a file, run a tiny local server instead:

```bash
# from inside the project folder
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## 🚀 Put it live on GitHub Pages (free)

### Option A — Upload through the GitHub website (no command line)

1. Go to <https://github.com/new> and create a repository.
   - To use the **free `username.github.io` URL**, name the repo exactly `yourusername.github.io`.
   - For any other name (e.g. `gamedayinmycity`), the site will live at `https://yourusername.github.io/gamedayinmycity/`.
2. On the new repo page, click **uploading an existing file**.
3. Drag in **everything inside this folder** (the `index.html`, the `css`, `js`, and `assets` folders, etc.). Keep the folder structure.
4. Click **Commit changes**.
5. Go to **Settings → Pages**. Under **Build and deployment → Source**, choose **Deploy from a branch**, pick the `main` branch and `/ (root)` folder, then **Save**.
6. Wait ~1 minute, refresh the Pages settings page, and your live URL will appear at the top.

### Option B — Command line (git)

```bash
cd gamedayinmycity
git init
git add .
git commit -m "Initial commit: GameDayInMyCity landing page"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/YOURREPO.git
git push -u origin main
```

Then enable Pages: **Settings → Pages → Source → Deploy from a branch → `main` / root → Save**.

---

## 🌐 Use your own domain (gamedayinmycity.com)

A `CNAME` file is already included pointing to **gamedayinmycity.com**. To connect it:

1. Buy/own the domain at any registrar (Namecheap, GoDaddy, Cloudflare, etc.).
2. In your domain's **DNS settings**, add these records:

   **Apex domain (gamedayinmycity.com)** — four `A` records pointing to GitHub Pages:
   ```
   A   @   185.199.108.153
   A   @   185.199.109.153
   A   @   185.199.110.153
   A   @   185.199.111.153
   ```
   **www subdomain:**
   ```
   CNAME   www   YOURUSERNAME.github.io
   ```
3. In GitHub: **Settings → Pages → Custom domain**, enter `gamedayinmycity.com`, **Save**, then tick **Enforce HTTPS** once it's available.

DNS can take anywhere from a few minutes to 24 hours to propagate.

> If you do **not** want a custom domain yet, just delete the `CNAME` file before deploying.

---

## 🧱 Important: this is a front-end demo

The page looks and behaves like a real product, but the dynamic parts are **simulated in the browser** for demonstration. To turn it into a working product you'll need to build (or integrate) back-end services:

- **Live scores / streaming / stats** — real data feeds, a video pipeline, and a database. The on-screen scores, viewer count, and clock are randomized in `main.js`.
- **Coach (AI assistant)** — currently returns canned answers. A real version connects to an AI API plus your sports/schedule/gear data.
- **Search, city pages, team pages** — need a database and server.
- **Shop** — product links are placeholders; wire them to real affiliate/store URLs.
- **Betting / Fantasy** — heavily regulated. Odds and "where legal" labels are placeholders. Real sportsbook features require legal review, state-by-state compliance, age verification (21+), and licensed data providers. Keep the 1-800-GAMBLER responsible-gaming messaging.
- **Youth / family-safe & recruiting features** — imply data handling, moderation, and privacy obligations (e.g. minors' data). Get these reviewed before launch.

### Suggested next steps
1. Ship this landing page on GitHub Pages to validate the look and collect interest.
2. Add a real email signup (e.g. a form service) to start a waitlist.
3. Decide the first **one** feature to build for real (Coach, or local team pages are good starts) and stand up a small back-end for it.

---

## 📄 License

MIT — see `LICENSE`. Note: the logo and Coach photo are your brand assets; replace the placeholder images with your finalized artwork before public launch.
