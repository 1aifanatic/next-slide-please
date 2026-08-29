# Next Slide Please

Turn any publicly shared Google Slides deck into a smartly timed, hands-free presentation.

**Live app:** https://next-slide-please.aiconic-innovations.workers.dev

## What it does

- Imports a public Google Slides link without Google OAuth
- Extracts slide text locally and recommends a conversational speaking time
- Lets you select a brisk, natural, or detailed pace—or tune every slide manually
- Presents the original slides with automatic per-slide advancement
- Provides pause, back, forward, full-screen, and keyboard controls
- Creates a shareable run link containing the deck URL and timing plan
- Opens shared run links directly in hands-free presentation mode
- Works on desktop and mobile

## How it works

The Cloudflare Worker validates the Google Slides URL, constructs a fixed Google export URL, and streams the public deck as a PDF. PDF.js renders and analyzes the deck entirely in the browser. Slide timing plans are encoded in the share link, so no database, account, or tracking is required.

Only decks set to **Share → General access → Anyone with the link** can be imported.

## Run locally

```bash
npm install
npm run build
npx wrangler dev
```

Open http://localhost:8787.

## Development

For front-end hot reload, run both processes:

```bash
npx wrangler dev --port 8787
npm run dev
```

Vite runs at http://localhost:5173 and proxies `/api` calls to the local Worker.

Useful commands:

```bash
npm run check       # Type-check the app and Worker
npm run build       # Create the production bundle
npm run cf-typegen  # Regenerate Cloudflare runtime types
npm run deploy      # Build and deploy to Cloudflare
```

## Deploy your own copy

1. Install dependencies with `npm install`.
2. Authenticate with `npx wrangler login`.
3. Change `name` in `wrangler.jsonc` if you want a different Worker name.
4. Run `npm run deploy`.

## Privacy and security

- No account is required.
- The app stores only the most recently used deck URL in local browser storage.
- Deck files are marked `private, no-store` by the Worker.
- The import endpoint cannot be used as an open proxy: it extracts a Slides ID and fetches only a fixed `docs.google.com` export path.
- Share links contain the public deck URL and slide durations. Anyone with a run link can open that already-public deck.

## License

[MIT](LICENSE) — free to use, modify, and share.
