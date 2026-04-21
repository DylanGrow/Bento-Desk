'use strict';

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const compression = require('compression');
const https       = require('https');
const http        = require('http');
const path        = require('path');
const { parseStringPromise } = require('xml2js');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({ origin: '*', methods: ['GET'] }));

const limiter = rateLimit({ windowMs: 60*1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

/* Serve static files from root — flat structure, no public/ subfolder */
app.use(express.static(path.join(__dirname, '.'), { maxAge: '1h', etag: true }));

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();
function getCache(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CommandCenter/4.0)', 'Accept': 'application/rss+xml, text/xml, */*' },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

async function parseRSS(url, limit = 20) {
  const cached = getCache(url);
  if (cached) return cached;
  const raw = await fetchUrl(url);
  const parsed = await parseStringPromise(raw, { explicitArray: false, trim: true });
  const channel = parsed?.rss?.channel || parsed?.feed;
  const rawItems = channel?.item || channel?.entry || [];
  const items = (Array.isArray(rawItems) ? rawItems : [rawItems])
    .slice(0, limit)
    .map(i => ({ title: i.title?._ || i.title || '', link: i.link?.href || i.link || i.guid?._ || i.guid || '#' }))
    .filter(i => i.title);
  setCache(url, items);
  return items;
}

const FEEDS = {
  wire: 'https://feeds.reuters.com/reuters/topNews',
  nfl:  'https://www.espn.com/espn/rss/nfl/news',
  nba:  'https://www.cbssports.com/rss/headlines/nba/',
  mlb:  'https://www.espn.com/espn/rss/mlb/news',
  info: 'https://www.informationweek.com/rss.xml',
};

Object.entries(FEEDS).forEach(([key, url]) => {
  app.get(`/api/${key}`, async (req, res) => {
    try {
      const items = await parseRSS(url);
      res.set('Cache-Control', 'public, max-age=300');
      return res.json(items);
    } catch (err) {
      console.error(`[${key}]`, err.message);
      return res.status(502).json({ error: `Failed to load ${key}`, detail: err.message });
    }
  });
});

app.get('/api/weather', async (req, res) => {
  const cached = getCache('weather');
  if (cached) return res.json(cached);
  try {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
    const geoUrl = clientIp && !clientIp.startsWith('127.') && !clientIp.startsWith('::')
      ? `https://ipapi.co/${clientIp}/json/` : 'https://ipapi.co/json/';
    const geo = JSON.parse(await fetchUrl(geoUrl));
    if (!geo.latitude) throw new Error('Geolocation failed');
    const w = JSON.parse(await fetchUrl(
      `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current_weather=true&temperature_unit=fahrenheit`
    ));
    const result = { temperature: w.current_weather.temperature, weathercode: w.current_weather.weathercode,
      city: geo.city || 'Unknown', region: geo.region_code || '', org: geo.org || '' };
    setCache('weather', result);
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(result);
  } catch (err) {
    return res.status(502).json({ error: 'Weather unavailable', detail: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/sitemap.xml', (req, res) => {
  const base = process.env.SITE_URL || 'https://yoursite.com';
  res.set('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url></urlset>`);
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => res.status(500).json({ error: 'Server error' }));

app.listen(PORT, () => console.log(`✓ Running on port ${PORT}`));
module.exports = app;
