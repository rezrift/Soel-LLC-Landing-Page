# soel.gg

The Soel landing page: a static site (GitHub Pages, free) with a games grid
that shows live player counts pulled from Roblox's public API by a scheduled
GitHub Action.

## What's here

```
index.html              the page
css/style.css            styling (dark theme, red accent)
js/main.js                renders the games grid + hero stats from the JSON below
data/games.json          static per-game info you edit by hand
data/stats.json          live numbers, written automatically by the Action below
assets/logo.png          your logo, trimmed + squared for the nav/hero mark
assets/favicon.png       small version of the logo, used as the browser tab icon
assets/games/*.png       per-game card images
.github/workflows/update-stats.yml   polls Roblox every 15 min, commits data/stats.json
CNAME                     tells GitHub Pages this site should answer to soel.gg
```

Both live games (Midnight Hours, ASMR Dominoes), the real logo, and every
footer social link (Roblox, X, TikTok, Twitch, YouTube, Email) are wired in.
SHOES is deliberately left out of live tracking (marked
`"status": "in-development"` in `data/games.json`) since it has no Roblox
page yet; flip that once it ships.

## How the live stats work

`.github/workflows/update-stats.yml` runs `scripts/fetch-stats.mjs` on a
schedule (every 15 minutes), plus whenever you push a change to
`data/games.json`, plus on-demand from the Actions tab (**Run workflow**
button). The script:

1. Resolves each game's `placeId` to a `universeId` via Roblox's API.
2. Calls Roblox's public games API for current players (`playing`) and
   lifetime `visits`.
3. Keeps a running **peak players** figure per game in `data/stats.json`
   (`peakPlaying`) — the highest `playing` value it's ever recorded. This
   isn't shown on the page right now (scrapped for v1 — see below), but the
   data's there if you want to surface it later.
4. Commits `data/stats.json` back to the repo if anything changed.

The page itself just fetches that static JSON file on load — no API calls
happen in the visitor's browser, so nothing breaks or gets rate-limited by
traffic.

**A couple of things worth knowing:**
- GitHub Actions on a schedule are best-effort — they can run a few minutes
  late, especially during high load. That's fine for "roughly live" numbers,
  but don't expect second-by-second accuracy.
- GitHub automatically pauses scheduled workflows on a repo after about 60
  days with no commits at all. If that ever happens, either push any commit
  or hit **Run workflow** manually on the Actions tab to wake it back up.
- I looked into whether RTrack, Rolimons, or RoMonitor Stats could supply a
  true historical peak CCU number and pull it in automatically. RTrack's
  free tier is capped at 10 requests/month (too low for scheduled polling),
  and I couldn't find documented, stable public API endpoints for
  game-level peak stats from Rolimons or RoMonitor Stats. If you find the
  right endpoint for one of those, it'd be a clean addition to
  `fetch-stats.mjs` — happy to wire it in.

## Publishing this as a GitHub repo + enabling Pages

1. Create a new repo on GitHub (public — private repos need a paid plan for
   Pages on personal accounts). Don't initialize it with a README, since
   this folder already has one.
2. From this folder:
   ```bash
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git add -A
   git commit -m "Initial soel.gg landing page"
   git branch -M main
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages**.
   - Under **Build and deployment**, set **Source** to **Deploy from a
     branch**.
   - Branch: `main`, folder: `/ (root)`. Save.
4. Still on that Pages settings screen, under **Custom domain**, enter
   `soel.gg` and save. GitHub will re-confirm/re-write the `CNAME` file for
   you. Leave **Enforce HTTPS** off until DNS has propagated and GitHub
   shows the domain as verified — then turn it on.

## Pointing soel.gg's DNS at GitHub Pages (Namecheap)

1. Log into Namecheap → **Domain List** → click **Manage** next to
   `soel.gg` → **Advanced DNS** tab.
2. **Delete** any existing record for the bare domain (`@`) — Namecheap
   often ships a default "URL Redirect" or parking-page record there that
   will conflict with what you're about to add.
3. Add these **A Records** (Host = `@`) — GitHub requires all four:

   | Type | Host | Value |
   |------|------|-------|
   | A | @ | 185.199.108.153 |
   | A | @ | 185.199.109.153 |
   | A | @ | 185.199.110.153 |
   | A | @ | 185.199.111.153 |

4. (Optional, IPv6) Add these **AAAA Records** (Host = `@`):

   | Type | Host | Value |
   |------|------|-------|
   | AAAA | @ | 2606:50c0:8000::153 |
   | AAAA | @ | 2606:50c0:8001::153 |
   | AAAA | @ | 2606:50c0:8002::153 |
   | AAAA | @ | 2606:50c0:8003::153 |

5. If you want `www.soel.gg` to also work, add:

   | Type | Host | Value |
   |------|------|-------|
   | CNAME | www | `<your-username>.github.io.` |

   (Use your actual GitHub username/org and repo's Pages domain — the
   trailing dot is fine either way in Namecheap.)

6. Save. DNS changes can take anywhere from a few minutes up to 24 hours to
   fully propagate. Once it has, go back to **Settings → Pages** in your
   repo and confirm GitHub shows `soel.gg` as verified, then flip on
   **Enforce HTTPS**.

Total cost: $0. GitHub Pages and GitHub Actions (on a public repo) are free
with no bandwidth or time-based charges at this scale; the only thing
you're paying for is the domain registration you already have.
