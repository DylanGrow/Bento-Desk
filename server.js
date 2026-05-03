'use strict';

/**
 * SysLog Dashboard - Frontend Logic
 * Replaces Express backend with direct browser-to-API calls.
 */

const FEEDS = {
    wire: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', // Updated to reliable NYT feed
    nfl:  'https://www.espn.com/espn/rss/nfl/news',
    nba:  'https://www.cbssports.com/rss/headlines/nba/',
    mlb:  'https://www.espn.com/espn/rss/mlb/news',
    info: 'https://www.informationweek.com/rss.xml',
};

// --- Weather Logic ---
async function updateWeather() {
    const tempEl = document.getElementById('temp');
    const cityEl = document.getElementById('city');
    const conditionEl = document.getElementById('condition');

    try {
        // 1. Get Location via IP
        const geoRes = await fetch('https://ipapi.co/json/');
        const geo = await geoRes.json();
        
        // 2. Get Weather via Open-Meteo
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current_weather=true&temperature_unit=fahrenheit`;
        const wRes = await fetch(weatherUrl);
        const w = await wRes.json();

        // 3. Update UI
        if (tempEl) tempEl.innerText = `${Math.round(w.current_weather.temperature)}°F`;
        if (cityEl) cityEl.innerText = geo.city || 'Local';
        if (conditionEl) conditionEl.innerText = getWeatherDesc(w.current_weather.weathercode);
        
    } catch (err) {
        console.error('[Weather Error]:', err);
        if (tempEl) tempEl.innerText = '--°F';
    }
}

// Helper to map Open-Meteo codes to text
function getWeatherDesc(code) {
    const codes = { 0: 'Clear', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast', 45: 'Fog', 61: 'Rain' };
    return codes[code] || 'Cloudy';
}

// --- News / RSS Logic ---
async function updateNews() {
    for (const [key, url] of Object.entries(FEEDS)) {
        try {
            // Use AllOrigins proxy to bypass CORS
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();
            
            const parser = new DOMParser();
            const xml = parser.parseFromString(data.contents, "text/xml");
            const items = Array.from(xml.querySelectorAll("item")).slice(0, 10);

            const container = document.getElementById(`${key}-feed`);
            if (!container) continue;

            container.innerHTML = items.map(item => {
                const title = item.querySelector("title")?.textContent || "No Title";
                const link = item.querySelector("link")?.textContent || "#";
                return `<li><a href="${link}" target="_blank">${title}</a></li>`;
            }).join('');

        } catch (err) {
            console.error(`[News Error - ${key}]:`, err);
        }
    }
}

// --- Health / Uptime Mock ---
function updateSystemInfo() {
    const uptimeEl = document.getElementById('uptime');
    if (uptimeEl) {
        const now = new Date();
        uptimeEl.innerText = `System Live: ${now.toLocaleTimeString()}`;
    }
}

// --- Initialize ---
function init() {
    updateWeather();
    updateNews();
    updateSystemInfo();

    // Refresh every 15 minutes
    setInterval(updateWeather, 15 * 60 * 1000);
    setInterval(updateNews, 15 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', init);
