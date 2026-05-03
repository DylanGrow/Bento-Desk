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
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
const SITE_URL = process.env.SITE_URL || 'https://yoursite.com';

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors({ origin: CORS_ORIGIN, methods: ['GET'] }));

const limiter = rateLimit({ windowMs: 60*1000, max: 60, standardHeaders: true, legacyHeaders: false });
app.use('/api/', limiter);

/* Serve static files from root — flat structure, no public/ subfolder */
app.use(express.static(path.join(__dirname, '.'), { maxAge: '1h', etag: true }));

const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 100;
const cache = new Map();

function getCache(key) {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { cache.delete(key); return null; }
  return e.data;
}

function setCache(key, data) { 
  cache.set(key, { data, ts: Date.now() });
  // Simple eviction: remove oldest entry if over limit
  if (cache.size > MAX_CACHE_SIZE) {
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].ts - b[1].ts)[0];
    cache.delete(oldest[0]);
  }
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; CommandCenter/4.0)', 
        'Accept': 'application/rss+xml, text/xml, */*' 
      },
      timeout: 8000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
    });
    
    req.on('error', reject);
    req.on('timeout', () => { 
      req.destroy(); 
      reject(new Error('Request timeout (8s)')); 
    });
  });
}

async function parseRSS(url, limit = 20) {
  if (!isValidUrl(url)) throw new Error('Invalid feed URL');
  
  const cached = getCache(url);
  if (cached) return cached;
  
  try {
    const raw = await fetchUrl(url);
    const parsed = await parseStringPromise(raw, { explicitArray: false, trim: true });
    const channel = parsed?.rss?.channel || parsed?.feed;
    
    if (!channel) throw new Error('Invalid RSS structure');
    
    const rawItems = channel?.item || channel?.entry || [];
    const items = (Array.isArray(rawItems) ? rawItems : [rawItems])
      .slice(0, limit)
      .map(i => ({ 
        title: i.title?._ || i.title || '', 
        link: i.link?.href || i.link || i.guid?._ || i.guid || '#' 
      }))
      .filter(i => i.title && i.title.trim());
    
    setCache(url, items);
    return items;
  } catch (err) {
    throw new Error(`RSS parsing failed: ${err.message}`);
  }
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
      return res.status(502).json({ 
        error: `Failed to load ${key}`, 
        detail: err.message 
      });
    }
  });
});

app.get('/api/weather', async (req, res) => {
  const cached = getCache('weather');
  if (cached) return res.json(cached);
  
  try {
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
    const geoUrl = clientIp && !clientIp.startsWith('127.') && !clientIp.startsWith('::') && !clientIp.includes('unknown')
      ? `https://ipapi.co/${clientIp}/json/` 
      : 'https://ipapi.co/json/';
    
    const geoData = await fetchUrl(geoUrl);
    const geo = JSON.parse(geoData);
    
    if (!geo.latitude || !geo.longitude) throw new Error('Geolocation failed');
    
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current_weather=true&temperature_unit=fahrenheit`;
    const weatherData = await fetchUrl(weatherUrl);
    const w = JSON.parse(weatherData);
    
    if (!w.current_weather) throw new Error('Weather data unavailable');
    
    const result = { 
      temperature: w.current_weather.temperature, 
      weathercode: w.current_weather.weathercode,
      city: geo.city || 'Unknown', 
      region: geo.region_code || '', 
      org: geo.org || '' 
    };
    
    setCache('weather', result);
    res.set('Cache-Control', 'public, max-age=300');
    return res.json(result);
  } catch (err) {
    console.error('[weather]', err.message);
    return res.status(502).json({ 
      error: 'Weather unavailable', 
      detail: err.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  return res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cacheSize: cache.size
  });
});

app.get('/sitemap.xml', (req, res) => {
  res.set('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE_URL}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url></urlset>`);
});

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Server error', detail: err.message });
});

// Graceful shutdown
const server = app.listen(PORT, () => console.log(`✓ Running on port ${PORT}`));

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
