'use strict';

const CONFIG = {
    batchSize: 12, // items per scroll load
};

// --- STATE ---
let ALL_ITEMS = [];
let visibleCount = 0;

// --- HELPERS ---

function getFavicon(url) {
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch {
        return '';
    }
}

function timeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts * 1000) / 1000);

    const intervals = [
        { label: 'y', secs: 31536000 },
        { label: 'mo', secs: 2592000 },
        { label: 'd', secs: 86400 },
        { label: 'h', secs: 3600 },
        { label: 'm', secs: 60 }
    ];

    for (const i of intervals) {
        const count = Math.floor(seconds / i.secs);
        if (count >= 1) return `${count}${i.label} ago`;
    }

    return 'just now';
}

// --- RENDER ---

function renderNextBatch() {
    const container = document.getElementById('feed');

    const nextItems = ALL_ITEMS.slice(visibleCount, visibleCount + CONFIG.batchSize);

    nextItems.forEach(item => {
        const card = document.createElement('a');
        card.href = item.link;
        card.target = '_blank';
        card.className = 'card';

        const icon = getFavicon(item.link);

        card.innerHTML = `
            <div class="card-header">
                <img src="${icon}" class="favicon" />
                <span class="source">${item.source}</span>
                <span class="time">${timeAgo(item.timestamp)}</span>
            </div>
            <div class="title">${item.title}</div>
        `;

        container.appendChild(card);
    });

    visibleCount += nextItems.length;
}

// --- SCROLL OBSERVER ---

function setupInfiniteScroll() {
    const sentinel = document.getElementById('scroll-sentinel');

    const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
            renderNextBatch();
        }
    });

    observer.observe(sentinel);
}

// --- DATA LOAD ---

async function loadNews() {
    const container = document.getElementById('feed');
    container.innerHTML = '<div class="status">Loading feed...</div>';

    try {
        const res = await fetch('./data.json?t=' + Date.now());
        const data = await res.json();

        ALL_ITEMS = data.items || [];

        // Already sorted by backend, but safe:
        ALL_ITEMS.sort((a, b) => b.timestamp - a.timestamp);

        container.innerHTML = '';
        visibleCount = 0;

        renderNextBatch();
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="status">Failed to load data.json</div>';
    }
}

// --- WEATHER (unchanged, trimmed slightly) ---

async function updateWeather() {
    try {
        const geo = await (await fetch('https://ipapi.co/json/')).json();

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current_weather=true&temperature_unit=fahrenheit`;
        const w = await (await fetch(url)).json();

        document.getElementById('w-temp').innerText = `${Math.round(w.current_weather.temperature)}°F`;
        document.getElementById('w-wind').innerText = `${Math.round(w.current_weather.windspeed)} mph`;
        document.getElementById('w-loc').innerText = `${geo.city}, ${geo.region_code}`;
    } catch (e) {
        console.warn('Weather failed', e);
    }
}

// --- INIT ---

document.addEventListener('DOMContentLoaded', () => {
    loadNews();
    setupInfiniteScroll();
    updateWeather();
});
