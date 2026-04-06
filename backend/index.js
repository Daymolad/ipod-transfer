const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const { listVolumes, isIpod, scanIpod } = require('./scanner');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'iPod Transfer Backend Running' });
});

app.get('/api/volumes', async (req, res) => {
    try {
        const volumes = await listVolumes();
        // check which are iPods
        const result = [];
        for (const v of volumes) {
            const ipod = await isIpod(v.path);
            result.push({ ...v, isIpod: ipod });
        }
        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/scan', async (req, res) => {
    const { path: ipodPath } = req.body;
    if (!ipodPath) return res.status(400).json({ error: "No path provided" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const onProgress = (prog) => {
            res.write(`data: ${JSON.stringify({ type: 'progress', ...prog })}\n\n`);
        };
        const data = await scanIpod(ipodPath, onProgress);
        res.write(`data: ${JSON.stringify({ type: 'complete', data })}\n\n`);
        res.end();
    } catch (e) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: e.message })}\n\n`);
        res.end();
    }
});

app.post('/api/transfer', async (req, res) => {
    const { files, destination } = req.body;
    if (!files || !destination) return res.status(400).json({ error: "Missing files or destination" });

    // Ensure destination exists
    await fs.mkdir(destination, { recursive: true }).catch(() => { });

    try {
        // We'll set headers for Server-Sent Events to stream progress
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let count = 0;
        for (const file of files) {
            const ext = path.extname(file.path);
            // build dynamic safe filename
            const safeTitle = file.title.replace(/[\/\\?%*:|"<>]/g, '-');
            const safeArtist = file.artist.replace(/[\/\\?%*:|"<>]/g, '-');

            // folder structure inside dest: Category / Artist / Title
            const targetFolder = path.join(destination, file.category, safeArtist);
            await fs.mkdir(targetFolder, { recursive: true }).catch(() => { });

            const destPath = path.join(targetFolder, `${safeTitle}${ext}`);

            await fs.copyFile(file.path, destPath);
            count++;

            res.write(`data: ${JSON.stringify({ progress: count, total: files.length, current: safeTitle })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ complete: true })}\n\n`);
        res.end();
    } catch (e) {
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
    }
});

function startBackend() {
    return new Promise((resolve) => {
        const server = app.listen(0, () => {
            const port = server.address().port;
            console.log(`Backend server is running on http://localhost:${port}`);
            resolve(port);
        });
    });
}

// If run directly, start it (for development). If required by Electron, export it.
if (require.main === module) {
    const defaultPort = process.env.PORT || 3001;
    app.listen(defaultPort, () => {
        console.log(`Backend server is running on http://localhost:${defaultPort}`);
    });
} else {
    module.exports = startBackend;
}
