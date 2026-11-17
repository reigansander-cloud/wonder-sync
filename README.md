# Wonder Sync

Real-time multiplayer 7 Wonders (with Leaders, Cities, Edifice and Armada),
plus editors for custom cards, wonders and edifices. A React (Vite) site on
GitHub Pages; game data, live updates and image uploads are on Supabase.
No accounts: anyone with the link can play.

## Run it locally

```
npm install
cp .env.example .env.local   # fill in your Supabase URL and anon key
npm run dev
```

## How it's put together

| Piece | Where |
|---|---|
| Data client (same `base44.entities.*` calls the app always used) | `src/api/base44Client.js`, `src/api/compat.js` |
| Supabase project URL + public key | `src/config.js` |
| Database, permissions, live updates, image bucket | `supabase/schema.sql` |
| Deploy to GitHub Pages (every push to `main`) | `.github/workflows/deploy.yml` |
| One-off move from Base44 | `migration/migrate-from-base44.js` |
| Page that sends the old Base44 address here | `base44-redirect/App.jsx` |

## Where it lives

- Site: https://reigansander-cloud.github.io/wonder-sync/
- Supabase project: `wonder-sync` (pcfxwugndktkomxgfauc)
- Old Base44 app (now just a redirect): https://wonder-sync-play.base44.app

## Setting up from scratch

1. **Supabase**: create a project, open *SQL Editor*, paste all of
   `supabase/schema.sql` and run it (safe to re-run).
2. Put the Project URL and anon/publishable key (*Project Settings → API*)
   in `src/config.js`.
3. **GitHub**: push this folder to a repo, then *Settings → Pages → Source:
   GitHub Actions*. The site appears at `https://YOU.github.io/REPO/`.
4. **Data**: fill in the two values at the top of
   `migration/migrate-from-base44.js`, open the old Base44 site, paste the
   file into the browser console and press Enter.
5. **Old site**: replace `src/App.jsx` in the Base44 project with
   `base44-redirect/App.jsx` (set `NEW_SITE` first).

## Good to know

- A free Supabase project pauses after about a week with no visits; restore
  it with one click in the dashboard.
- Games untouched for 30 days are deleted automatically if the `pg_cron`
  extension is on (*Database → Extensions*); otherwise they just stay.
- Everything is open, like on Base44: anyone with the site can play, upload
  images and edit the custom cards/wonders/edifices.
