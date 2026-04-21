# Command Center v4.0

Real-time news, sports scores, weather and secure search dashboard.

## Project Structure

```
command-center/
├── api/
│   └── server.js          ← Express REST API (all backend logic)
├── public/
│   ├── index.html         ← Main dashboard (SEO, a11y, responsive)
│   ├── sitemap.xml        ← Static sitemap (also served dynamically)
│   ├── robots.txt         ← Search engine directives
│   └── manifest.json      ← PWA manifest
├── docs/
│   └── wireframe-desktop.svg
└── package.json
```

## Quick Start

```bash
npm install
npm start
# → http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

| Method | Endpoint       | Description                        | Cache TTL |
|--------|----------------|------------------------------------|-----------|
| GET    | /api/weather   | Current weather for client IP      | 5 min     |
| GET    | /api/wire      | Reuters world news (up to 20)      | 5 min     |
| GET    | /api/nfl       | ESPN NFL headlines (up to 20)      | 5 min     |
| GET    | /api/nba       | CBS Sports NBA headlines (up to 20)| 5 min     |
| GET    | /api/mlb       | ESPN MLB headlines (up to 20)      | 5 min     |
| GET    | /api/info      | InformationWeek tech news          | 5 min     |
| GET    | /api/health    | Health check (uptime, cache size)  | no cache  |
| GET    | /sitemap.xml   | XML sitemap                        | —         |
| GET    | /robots.txt    | Robots directives                  | —         |

### Example Response — /api/wire

```json
[
  {
    "title": "World leaders meet on trade deal",
    "link": "https://reuters.com/..."
  },
  ...
]
```

### Example Response — /api/weather

```json
{
  "temperature": 72,
  "weathercode": 1,
  "city": "Charlotte",
  "region": "NC",
  "country": "United States",
  "org": "AS7922 Comcast Cable",
  "latitude": 35.22,
  "longitude": -80.84
}
```

## Environment Variables

| Variable         | Default                  | Description                       |
|------------------|--------------------------|-----------------------------------|
| PORT             | 3000                     | Server port                       |
| SITE_URL         | https://yoursite.com     | Used in sitemap and robots.txt    |
| ALLOWED_ORIGIN   | *                        | CORS allowed origin               |
| NODE_ENV         | development              | Set to production for deployment  |

```bash
PORT=8080 SITE_URL=https://example.com node api/server.js
```

## SEO Checklist

- [x] `<title>` and `<meta name="description">` on every page
- [x] Open Graph tags (og:title, og:description, og:image, og:url)
- [x] Twitter Card meta tags
- [x] JSON-LD structured data (WebApplication schema)
- [x] Canonical URL `<link rel="canonical">`
- [x] `/sitemap.xml` — static file + dynamic route
- [x] `/robots.txt` — allows crawlers, blocks `/api/`
- [x] Semantic HTML5 elements (`<main>`, `<nav>`, `<section>`)
- [x] `<h1>`-`<h2>` heading hierarchy
- [x] PWA manifest with `theme-color`

## Accessibility (WCAG 2.1 AA)

- [x] Skip navigation link (`.skip-link`) for keyboard users
- [x] All sections have `aria-labelledby` pointing to visible headings
- [x] News feeds use `aria-live="polite"` + `aria-busy` during load
- [x] Tickers have `aria-live="off"` (motion is decorative, not content)
- [x] Tickers are `aria-hidden="true"` or have `aria-label` on `<nav>`
- [x] All links have meaningful text (no "click here")
- [x] Search input has `<label>` (visually hidden via `.sr-only`)
- [x] Focus styles on all interactive elements (`:focus-visible`)
- [x] Ticker animation pauses on hover/focus-within
- [x] `@media (prefers-reduced-motion: reduce)` disables all animation
- [x] `@media (forced-colors: active)` high-contrast mode support
- [x] Color contrast — all text meets 4.5:1 ratio on dark backgrounds

## Responsive Breakpoints

| Breakpoint    | Layout                                      |
|---------------|---------------------------------------------|
| > 900px       | 3-column grid, left MLB sidebar ticker      |
| 560px–900px   | 2-column grid, left ticker hidden           |
| < 560px       | Single column stack, full-width cards       |

## Browser Support

Tested and compatible with:
- Chrome / Edge 90+
- Firefox 88+
- Safari 14+
- Mobile Safari (iOS 14+)
- Chrome for Android 90+

Uses: CSS Grid, CSS Custom Properties, `fetch()`, `DOMParser` — all baseline-supported.
No polyfills required for the target browsers above.

## Deployment

### Static host (Vercel, Netlify, etc.)
Point `public/` as the static root, and run `api/server.js` as a serverless function
or separate Node service.

### Single server (VPS, Railway, etc.)
```bash
NODE_ENV=production npm start
```
The Express server serves both the static files and the API on the same port.

### Nginx reverse proxy (recommended for production)
```nginx
server {
    listen 80;
    server_name yoursite.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```
Setting `X-Forwarded-For` is required for accurate weather geolocation.
