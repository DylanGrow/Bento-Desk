const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware tweaks
app.use(helmet({
    contentSecurityPolicy: false // disabled to allow external APIs/images
}));

app.use(compression());
app.use(cors({ methods: ['GET', 'OPTIONS'] })); // Restrict allowed methods

// Rate limiter tweak
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // limit each IP to 120 requests per windowMs
    message: "Too many requests, please try again later."
});
app.use(limiter);

// Prevent caching of data.json to ensure fresh feeds
app.use((req, res, next) => {
    if (req.url.includes('data.json')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    }
    next();
});

// Health check endpoint tweak
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// Serve static files from the current directory
app.use(express.static(__dirname));

// Fallback to index.html for any other requests safely tweak
app.get('*', (req, res, next) => {
    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Dashboard not found');
    }
});

// Global Error Handler tweak
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', err.stack);
    res.status(500).send('Internal Server Error');
});

const server = app.listen(PORT, () => {
    console.log(`Command Center running at http://localhost:${PORT}`);
});

// Graceful shutdown tweaks
const shutdown = () => {
    console.log('Shutting down server gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
});
