const fs = require('fs/promises');
const path = require('path');

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
async function parseMetadata(filePaths, onProgress) {
    const files = [];
    const musicMetadata = await import('music-metadata');
    const total = filePaths.length;
    let count = 0;
    
    for (const file of filePaths) {
        try {
            const ext = path.extname(file).toLowerCase();
            let category = 'music';
            let duration = 0;
            let title = path.basename(file);
            let artist = 'Unknown Artist';
            let album = 'Unknown Album';
            
            if (['.jpg', '.jpeg', '.png', '.bmp', '.gif'].includes(ext)) {
                category = 'photo';
            } else if (['.mp4', '.m4v', '.mov'].includes(ext)) {
                category = 'video';
            }
            
            if (category !== 'photo') {
                const metadata = await musicMetadata.parseFile(file, { duration: true, skipCovers: true });
                duration = metadata.format.duration || 0;
                title = metadata.common.title || title;
                artist = metadata.common.artist || artist;
                album = metadata.common.album || album;
                
                if (metadata.common.genre && metadata.common.genre.some(g => g.toLowerCase().includes('podcast'))) {
                    category = 'podcast';
                } else if (file.includes('Recordings') && file.endsWith('.wav')) {
                    category = 'voice_recording';
                }
            }

            files.push({
                path: file,
                title: title,
                artist: artist,
                album: album,
                duration: duration,
                category: category,
                size: (await fs.stat(file)).size
            });
        } catch (e) {
            // failed to parse, add as generic
            const stat = await fs.stat(file).catch(() => ({ size: 0 }));
            const ext = path.extname(file).toLowerCase();
            let category = file.includes('Recordings') ? 'voice_recording' : 'unknown';
            if (['.jpg', '.jpeg', '.png', '.bmp', '.gif'].includes(ext)) {
                category = 'photo';
            } else if (['.mp4', '.m4v', '.mov'].includes(ext)) {
                category = 'video';
            }
            files.push({
                path: file,
                title: path.basename(file),
                artist: 'Unknown',
                album: 'Unknown',
                duration: 0,
                category: category,
                size: stat.size
            });
        }
        
        count++;
        if (onProgress) {
            onProgress({ current: count, total: total, file: path.basename(file) });
        }
    }
    return files;
}

// Scan the iPod directories
async function scanIpod(basePath, onProgress) {
    const ipodControl = path.join(basePath, 'iPod_Control');
    const musicDir = path.join(ipodControl, 'Music');
    const recordingsDir = path.join(basePath, 'Recordings'); // Voice Memos are often outside iPod_Control or inside it.
    const photosDir = path.join(basePath, 'Photos');
    const dcimDir = path.join(basePath, 'DCIM');

    const extensions = ['.mp3', '.m4a', '.m4b', '.wav', '.aiff', '.aac', '.mp4', '.m4v', '.mov', '.jpg', '.jpeg', '.png', '.bmp', '.gif'];

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

    // Scan Photos
    try {
        const photoFiles = await findMediaFiles(photosDir, extensions);
        allMedia = allMedia.concat(photoFiles);
    } catch (e) { console.error('Error scanning photos dir', e); }

    // Scan DCIM
    try {
        const dcimFiles = await findMediaFiles(dcimDir, extensions);
        allMedia = allMedia.concat(dcimFiles);
    } catch (e) { console.error('Error scanning dcim dir', e); }

    // Parse all metadata
    const parsedFiles = await parseMetadata(allMedia, onProgress);
    return parsedFiles;
}

module.exports = {
    listVolumes,
    isIpod,
    scanIpod
};
