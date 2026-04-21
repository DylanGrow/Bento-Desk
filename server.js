/**
 * Command Center API
 * Node.js + Express REST API
 *
 * Endpoints:
 *   GET /api/weather     — current weather for client IP
 *   GET /api/wire        — Reuters world news
 *   GET /api/nfl         — ESPN NFL headlines
 *   GET /api/nba         — CBS Sports NBA headlines
 *   GET /api/mlb         — ESPN MLB headlines
 *   GET /api/info        — InformationWeek tech news
 *   GET /sitemap.xml     — XML sitemap
 *
 * Install: npm install
 * Run:     node server.js
 *          NODE_ENV=production node server.js
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const compression = require('compression');
const https      = require('https');
const http       = require('http');
const path       = require('path');
const { parseStringPromise } = require('xml2js');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ============================================================
   SECURITY & MIDDLEWARE
============================================================ */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:'],
      connectSrc:  ["'self'", 'https://ipapi.co', 'https://api.open-meteo.com'],
      fontSrc:     ["'self'"],
      objectSrc:   ["'none'"],
      frameAncestors: ["'none'"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET'],
  optionsSuccessStatus: 200,
}));

/* Rate limiting — 60 requests / minute per IP */
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again in a minute.' }
});
app.use('/api/', limiter);

app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '1h',
  etag: true,
}));

/* ============================================================
   IN-MEMORY CACHE
   Each feed is cached for CACHE_TTL ms to avoid hammering sources
============================================================ */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

/* ============================================================
   HTTP UTILITY
============================================================ */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CommandCenter/4.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

/* ============================================================
   RSS PARSER
============================================================ */
async function parseRSS(url, limit = 20) {
  const cached = getCache(url);
  if (cached) return cached;

  const raw = await fetchUrl(url);
  const parsed = await parseStringPromise(raw, { explicitArray: false, trim: true });
  const channel = parsed?.rss?.channel || parsed?.feed;
  const rawItems = channel?.item || channel?.entry || [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems])
    .slice(0, limit)
    .map(item => ({
      title: item.title?._ || item.title || '',
      link:  item.link?.href || item.link || item.guid?._ || item.guid || '#',
    }))
    .filter(i => i.title);

  setCache(url, items);
  return items;
}

/* ============================================================
   FEED DEFINITIONS
============================================================ */
const FEEDS = {
  wire: 'https://feeds.reuters.com/reuters/topNews',
  nfl:  'https://www.espn.com/espn/rss/nfl/news',
  nba:  'https://www.cbssports.com/rss/headlines/nba/',
  mlb:  'https://www.espn.com/espn/rss/mlb/news',
  info: 'https://www.informationweek.com/rss.xml',
};

/* ============================================================
   API ROUTES — FEEDS
============================================================ */
Object.entries(FEEDS).forEach(([key, url]) => {
  app.get(`/api/${key}`, async (req, res) => {
    try {
      const items = await parseRSS(url);
      res.set('Cache-Control', 'public, max-age=300'); // 5 min browser cache
      return res.json(items);
    } catch (err) {
      console.error(`[${key}] Feed error:`, err.message);
      return res.status(502).json({ error: `Failed to load ${key} feed`, detail: err.message });
    }
  });
});

/* ============================================================
   API ROUTE — WEATHER
============================================================ */
app.get('/api/weather', async (req, res) => {
  const cacheKey = 'weather';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    // Get IP geolocation
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim()
                  || req.socket.remoteAddress
                  || '';

    const geoUrl = clientIp && !clientIp.startsWith('127.') && !clientIp.startsWith('::')
      ? `https://ipapi.co/${clientIp}/json/`
      : 'https://ipapi.co/json/';

    const geoRaw = await fetchUrl(geoUrl);
    const geo    = JSON.parse(geoRaw);

    if (!geo.latitude || !geo.longitude) throw new Error('Geolocation failed');

    // Get weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${geo.latitude}&longitude=${geo.longitude}`
      + `&current_weather=true&temperature_unit=fahrenheit`;

    const weatherRaw  = await fetchUrl(weatherUrl);
    const weatherData = JSON.parse(weatherRaw);

    const result = {
      temperature:  weatherData.current_weather.temperature,
      weathercode:  weatherData.current_weather.weathercode,
      city:         geo.city         || 'Unknown',
      region:       geo.region_code  || '',
      country:      geo.country_name || '',
      org:          geo.org          || '',
      latitude:     geo.latitude,
      longitude:    geo.longitude,
    };

    setCache(cacheKey, result);
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(result);
  } catch (err) {
    console.error('[weather] Error:', err.message);
    return res.status(502).json({ error: 'Weather unavailable', detail: err.message });
  }
});

/* ============================================================
   API ROUTE — HEALTH CHECK
============================================================ */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache_keys: cache.size,
  });
});

/* ============================================================
   SITEMAP
============================================================ */
app.get('/sitemap.xml', (req, res) => {
  const base = process.env.SITE_URL || 'https://yoursite.com';
  const now  = new Date().toISOString().split('T')[0];
  const xml  = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${base}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

/* ============================================================
   ROBOTS.TXT
============================================================ */
app.get('/robots.txt', (req, res) => {
  const base = process.env.SITE_URL || 'https://yoursite.com';
  res.type('text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${base}/sitemap.xml\n`);
});

/* ============================================================
   404 & ERROR HANDLERS
============================================================ */
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/* ============================================================
   START
============================================================ */
app.listen(PORT, () => {
  console.log(`\n✓ Command Center API running on http://localhost:${PORT}`);
  console.log(`  GET /api/weather  — weather for client IP`);
  console.log(`  GET /api/wire     — Reuters world news`);
  console.log(`  GET /api/nfl      — NFL headlines`);
  console.log(`  GET /api/nba      — NBA headlines`);
  console.log(`  GET /api/mlb      — MLB headlines`);
  console.log(`  GET /api/info     — InformationWeek`);
  console.log(`  GET /api/health   — health check`);
  console.log(`  GET /sitemap.xml  — XML sitemap`);
  console.log(`  GET /robots.txt   — robots directives\n`);
});

module.exports = app;
