const fs = require('fs/promises');
const path = require('path');
const musicMetadata = require('music-metadata');

// Utility to recursively find files with specific extensions
async function findMediaFiles(dir, extensions) {
    let results = [];
    try {
        const list = await fs.readdir(dir);
        for (const file of list) {
            const filePath = path.join(dir, file);
            if (file.startsWith('.')) continue; // skip hidden files

            const stat = await fs.stat(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(await findMediaFiles(filePath, extensions));
            } else {
                const ext = path.extname(filePath).toLowerCase();
                if (extensions.includes(ext)) {
                    results.push(filePath);
                }
            }
        }
    } catch (e) {
        // ignore errors (like permission denied)
    }
    return results;
}

// Find possible iPods by looking in /Volumes
async function listVolumes() {
    try {
        const volumes = await fs.readdir('/Volumes');
        return volumes.filter(v =>
            v !== 'Macintosh HD' &&
            !v.startsWith('.') &&
            v !== 'Recovery' &&
            v !== 'Preboot'
        ).map(v => ({ name: v, path: path.join('/Volumes', v) }));
    } catch (e) {
        return [];
    }
}

// Check if a path looks like an iPod
async function isIpod(volumePath) {
    try {
        const ipodControlStr = path.join(volumePath, 'iPod_Control');
        const stat = await fs.stat(ipodControlStr);
        return stat.isDirectory();
    } catch (e) {
        return false;
    }
}

// Parse metadata for found files
async function parseMetadata(filePaths) {
    const files = [];
    for (const file of filePaths) {
        try {
            const metadata = await musicMetadata.parseFile(file, { duration: true, skipCovers: true });

            // Categorize based on metadata
            let category = 'music';
            if (metadata.common.genre && metadata.common.genre.some(g => g.toLowerCase().includes('podcast'))) {
                category = 'podcast';
            } else if (file.includes('Recordings') && file.endsWith('.wav')) {
                category = 'voice_recording';
            }

            files.push({
                path: file,
                title: metadata.common.title || path.basename(file),
                artist: metadata.common.artist || 'Unknown Artist',
                album: metadata.common.album || 'Unknown Album',
                duration: metadata.format.duration || 0,
                category: category,
                size: (await fs.stat(file)).size
            });
        } catch (e) {
            // failed to parse, add as generic
            const stat = await fs.stat(file).catch(() => ({ size: 0 }));
            files.push({
                path: file,
                title: path.basename(file),
                artist: 'Unknown',
                album: 'Unknown',
                duration: 0,
                category: file.includes('Recordings') ? 'voice_recording' : 'unknown',
                size: stat.size
            });
        }
    }
    return files;
}

// Scan the iPod directories
async function scanIpod(basePath) {
    const ipodControl = path.join(basePath, 'iPod_Control');
    const musicDir = path.join(ipodControl, 'Music');
    const recordingsDir = path.join(basePath, 'Recordings'); // Voice Memos are often outside iPod_Control or inside it.

    const extensions = ['.mp3', '.m4a', '.m4b', '.wav', '.aiff', '.aac'];

    let allMedia = [];

    // Scan Music
    try {
        const musicFiles = await findMediaFiles(musicDir, extensions);
        allMedia = allMedia.concat(musicFiles);
    } catch (e) { console.error('Error scanning music dir', e); }

    // Scan Recordings
    try {
        const recordingFiles = await findMediaFiles(recordingsDir, extensions);
        allMedia = allMedia.concat(recordingFiles);
    } catch (e) { console.error('Error scanning recordings dir', e); }

    // Parse all metadata
    const parsedFiles = await parseMetadata(allMedia);
    return parsedFiles;
}

module.exports = {
    listVolumes,
    isIpod,
    scanIpod
};
