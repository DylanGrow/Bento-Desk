# Bento Desk 🍱

A modern, automated news aggregator and utility dashboard. Built with a Bento Grid layout, this site features real-time news pulls and IP-based weather detection without tracking.

## 🚀 Key Features
* **Bento Grid UI**: Responsive design with tactile hover-scaling effects.
* **Automated Aggregation**: GitHub Actions triggers a Python script to fetch RSS feeds daily.
* **Dynamic Utility**: Integrated weather (via Open-Meteo) and ISP-based location detection.
* **Dark Mode**: High-contrast theme optimized for IT and developer workflows.

## 🛠️ Technical Stack
* **Frontend**: HTML5, CSS Grid, Vanilla JavaScript (ES6+).
* **Backend**: Python 3.x (for RSS parsing and JSON generation).
* **Automation**: GitHub Actions (YAML workflows).
* **Hosting**: GitHub Pages.

## 📂 Project Structure
* `index.html`: Main interface and UI logic.
* `fetch_news.py`: Script to aggregate news data into `data.json`.
* `data.json`: Dynamically generated data store for headlines.
* `.github/workflows/rss-fetch.yml`: Automation schedule for daily updates.

## 🔧 Setup
1. Clone the repository.
2. Ensure **GitHub Actions** has "Read and Write" permissions in your repo settings.
3. The site will automatically deploy to GitHub Pages once the `main` branch is updated.
