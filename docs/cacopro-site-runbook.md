# CACO PRO Site Runbook

## Core Paths

- Site repo: `/Users/mac/Documents/整理归档/演讲与PPT制作/caco-site`
- Talks directory: `/Users/mac/Documents/整理归档/演讲与PPT制作/caco-site/talks`
- Current Zmagine talk: `/Users/mac/Documents/整理归档/演讲与PPT制作/caco-site/talks/zmagine-tech-conference`
- Domain cutover note: `/Users/mac/Documents/cacopro-domain-cutover-2026-03-24.md`

## Current Hosting Shape

- Production domain: `https://cacopro.vip/`
- Repository remote: `https://github.com/cacosub7/cacopro-site.git`
- Branch: `main`
- Vercel link file: `.vercel/project.json`
- Vercel project name: `cacopro-site`
- Custom domains already served by Vercel: `cacopro.vip`, `www.cacopro.vip`, `ai.cacopro.vip`, `misc.cacopro.vip`
- Cloudflare is used as the DNS and domain control layer, not as a code-hosted worker for this repo.

## Cloudflare Notes

The cutover note already records the stable identifiers and should be treated as the source of truth for DNS history:

- Cloudflare zone: `cacopro.vip`
- Zone id: `70b617fb4fc8f6a7cbb89a5a20ba9c62`
- Token location: macOS Keychain service `cloudflare-cacopro-token`

This site does not currently rely on a `wrangler.toml` or a Cloudflare Worker checked into the repo. For normal content releases, DNS changes are not required.

## Available Deployment Tooling

These CLIs are not globally on PATH in the current shell, but they work via `npx`:

```bash
npx -y vercel --version
npx -y wrangler --version
```

## Standard Release Workflow

### 1. Add or update a talk

1. Put the talk HTML at `talks/<slug>/index.html`.
2. Put local assets under `talks/<slug>/assets/`.
3. Add `<base href="/talks/<slug>/" />` to the HTML.
4. Add title, description, canonical URL, OG tags, and a share image.
5. Update `talks/index.html` with a new card.
6. Update `index.html` homepage if the new talk should become the primary promoted talk.
7. Update `sitemap.xml`.

### 2. Local preview

From the repo root:

```bash
python3 -m http.server 8080
```

Then open:

- `http://127.0.0.1:8080/`
- `http://127.0.0.1:8080/talks/`
- `http://127.0.0.1:8080/talks/<slug>/`

### 3. Run the talk smoke test

The reusable smoke test covers:

- slide count
- keyboard next-slide navigation
- hash-based deep linking
- burst wheel navigation handling

Run it like this:

```bash
NODE_PATH="$HOME/.agents/skills/dev-browser/node_modules" \
node scripts/verify-talk.mjs http://127.0.0.1:8080/talks/<slug>/
```

Current example:

```bash
NODE_PATH="$HOME/.agents/skills/dev-browser/node_modules" \
node scripts/verify-talk.mjs http://127.0.0.1:8080/talks/zmagine-tech-conference/
```

### 4. Production deployment

From the repo root:

```bash
npx -y vercel deploy --prod --yes
```

Because the repo is already linked to Vercel, this publishes the current working tree to the existing project.

### 5. Post-deploy validation

Check:

```bash
curl -I https://cacopro.vip/
curl -I https://cacopro.vip/talks/
curl -I https://cacopro.vip/talks/<slug>/
```

Then open the production pages in a browser and verify:

- assets load correctly
- the talk index card points to the right slug
- rapid next-slide interactions do not leave the page in an empty or broken state
- the shared domain still serves the homepage and archive correctly

## Zmagine Talk-Specific Notes

- Slug: `zmagine-tech-conference`
- Cover image: `assets/images/intro-tech-poster.jpeg`
- The page now uses controlled slide navigation with:
  - keyboard navigation
  - burst wheel handling
  - touch swipe support
  - hash syncing
  - `scroll-snap-stop: always`

## When To Touch Cloudflare

Only touch Cloudflare when one of these changes:

- a new domain or subdomain is added
- DNS is changing away from the current Vercel targets
- cache purge is needed after a stubborn edge cache issue

For normal talk and homepage content releases, Vercel deployment is enough.
