// Minimal static file server for local development: node serve.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
};

const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

    // Keep requests inside the project directory
    if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
    }

    res.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(filePath)] || 'text/plain',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT} (no cache)`));
