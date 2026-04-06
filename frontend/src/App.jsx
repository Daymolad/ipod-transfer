import { useState, useEffect } from 'react';
import axios from 'axios';
import { HardDrive, Music, Mic, Image as ImageIcon, FolderArchive, ArrowRight, CheckCircle2, Loader2, PlayCircle, Video } from 'lucide-react';
import './index.css';

const API_BASE = '/api';

function App() {
  const [volumes, setVolumes] = useState([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [destPath, setDestPath] = useState('/Users/Daymo/Music/iPod Transfer');
  const [scanning, setScanning] = useState(false);
  const [media, setMedia] = useState([]);
  const [category, setCategory] = useState('all');
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, file: '', etaStr: 'Calculating...' });

  // Transfer state
  const [transferring, setTransferring] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [transferComplete, setTransferComplete] = useState(false);

  useEffect(() => {
    fetchVolumes();
  }, []);

  const fetchVolumes = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/volumes`);
      setVolumes(data);
      if (data.length > 0) {
        // Auto-select first iPod found
        const ipod = data.find(v => v.isIpod);
        if (ipod) setSelectedPath(ipod.path);
        else setSelectedPath(data[0].path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScan = async () => {
    if (!selectedPath) return;
    setScanning(true);
    setScanProgress({ current: 0, total: 0, file: '', etaStr: 'Calculating...' });
    const start = Date.now();

    try {
      const response = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedPath })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr) {
              const data = JSON.parse(dataStr);
              if (data.type === 'progress') {
                const elapsed = (Date.now() - start) / 1000;
                let etaStr = 'Calculating...';
                if (data.current > 5) {
                    const rate = elapsed / data.current;
                    const remaining = (data.total - data.current) * rate;
                    etaStr = remaining > 60 ? `${Math.ceil(remaining / 60)} min` : `${Math.ceil(remaining)} sec`;
                }
                setScanProgress({ current: data.current, total: data.total, file: data.file, etaStr });
              } else if (data.type === 'complete') {
                setMedia(data.data);
                setSelectedFiles(new Set());
              } else if (data.type === 'error') {
                console.error(data.error);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  const startTransfer = async () => {
    const filesToTransfer = media.filter(m => selectedFiles.has(m.path));
    if (filesToTransfer.length === 0 || !destPath) return;

    setTransferring(true);
    setTransferComplete(false);
    setProgress(0);
    setTotalFiles(filesToTransfer.length);

    try {
      // For SSE we can use fetch/EventSource or just fallback to simple fetch and await
      // Since it's a POST, fetch with streaming response is best
      const response = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: filesToTransfer, destination: destPath })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr) {
              const data = JSON.parse(dataStr);
              if (data.complete) {
                setTransferComplete(true);
                setTransferring(false);
              } else if (data.error) {
                console.error(data.error);
                setTransferring(false);
              } else {
                setProgress(data.progress);
                setCurrentFile(data.current);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
      setTransferring(false);
    }
  };

  const getFilteredMedia = () => {
    if (category === 'all') return media;
    return media.filter(m => m.category === category);
  };

  const toggleSelection = (path) => {
    const newPaths = new Set(selectedFiles);
    if (newPaths.has(path)) {
      newPaths.delete(path);
    } else {
      newPaths.add(path);
    }
    setSelectedFiles(newPaths);
  };

  const toggleCategorySelection = () => {
    const newPaths = new Set(selectedFiles);
    const filtered = getFilteredMedia();
    const allSelected = filtered.length > 0 && filtered.every(m => newPaths.has(m.path));

    if (allSelected) {
      filtered.forEach(m => newPaths.delete(m.path));
    } else {
      filtered.forEach(m => newPaths.add(m.path));
    }
    setSelectedFiles(newPaths);
  };

  const isCategoryAllSelected = getFilteredMedia().length > 0 && getFilteredMedia().every(m => selectedFiles.has(m.path));

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case 'music': return <Music size={18} />;
      case 'podcast': return <PlayCircle size={18} />;
      case 'voice_recording': return <Mic size={18} />;
      case 'photo': return <ImageIcon size={18} />;
      case 'video': return <Video size={18} />;
      default: return <FolderArchive size={18} />;
    }
  };

  const filteredMedia = getFilteredMedia();
  const selectedFilesList = media.filter(m => selectedFiles.has(m.path));
  const summary = selectedFilesList.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <>
      <header className="header">
        <HardDrive size={28} className="text-sec" color="var(--accent-color)" />
        <h1>iPod Extraction Toolkit</h1>
      </header>

      <main className="container">
        <div className="grid-2">
          {/* Left Column: Configuration */}
          <div className="glass-panel">
            <h2 className="text-sm text-sec" style={{ marginBottom: '16px', fontWeight: 600 }}>DEVICE CONFIGURATION</h2>

            <div className="input-group">
              <label>Select Device Volume</label>
              <select
                className="glass-input"
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
              >
                <option value="">-- Select Volume --</option>
                {volumes.map(v => (
                  <option key={v.path} value={v.path}>
                    {v.name} {v.isIpod ? '(iPod Detected)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label>Custom Source Path (Optional)</label>
              <input
                type="text"
                className="glass-input"
                value={selectedPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                placeholder="/Volumes/My iPod"
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              onClick={handleScan}
              disabled={scanning || !selectedPath}
            >
              {scanning ? <><Loader2 className="spinner" size={18} /> Scanning iPod...</> : 'Scan Device'}
            </button>

            {media.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <h2 className="text-sm text-sec" style={{ marginBottom: '16px', fontWeight: 600 }}>TRANSFER SETTINGS</h2>
                <div className="input-group">
                  <label>Destination Path</label>
                  <input
                    type="text"
                    className="glass-input"
                    value={destPath}
                    onChange={(e) => setDestPath(e.target.value)}
                  />
                </div>

                <div style={{ padding: '16px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '8px', margin: '16px 0' }}>
                  <p className="text-sm">Ready to extract <strong>{selectedFiles.size}</strong> items ({formatBytes(summary)})</p>
                </div>

                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={startTransfer}
                  disabled={transferring || selectedFiles.size === 0}
                >
                  {transferring ? 'Transferring...' : <><ArrowRight size={18} /> Start Transfer</>}
                </button>

                {transferring && (
                  <div className="progress-container">
                    <div className="flex-between text-xs text-sec">
                      <span>{currentFile || 'Initiating...'}</span>
                      <span>{progress} / {totalFiles}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${(progress / totalFiles) * 100}%` }}></div>
                    </div>
                  </div>
                )}

                {transferComplete && (
                  <div className="progress-container flex-center" style={{ color: '#10b981', gap: '8px' }}>
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-medium">Transfer Complete!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Media Preview */}
          <div className="glass-panel" style={{ height: 'calc(100vh - 180px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <h2 className="text-sm text-sec" style={{ marginBottom: '16px', fontWeight: 600 }}>DISCOVERED MEDIA</h2>

            <div className="tabs">
              {['all', 'music', 'podcast', 'voice_recording', 'photo', 'video'].map(c => (
                <div
                  key={c}
                  className={`tab ${category === c ? 'active' : ''}`}
                  onClick={() => setCategory(c)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {c.replace('_', ' ')}
                </div>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
              {media.length === 0 && !scanning && (
                <div className="flex-center text-sec" style={{ height: '100%', flexDirection: 'column', gap: '16px' }}>
                  <FolderArchive size={48} opacity={0.5} />
                  <p>No media discovered yet. Scan a device to begin.</p>
                </div>
              )}

              {scanning && (
                <div className="flex-center text-sec" style={{ height: '100%', flexDirection: 'column', gap: '24px', padding: '0 32px' }}>
                  <Loader2 size={48} className="spinner" style={{ animation: 'spin 2s linear infinite' }} />
                  <div style={{ textAlign: 'center', width: '100%' }}>
                    <p style={{ marginBottom: '8px', color: '#fff' }}>Deep scanning device sectors...</p>
                    <p className="text-xs" style={{ minHeight: '16px' }}>{scanProgress.file || 'Initializing scanner'}</p>
                  </div>
                  
                  {scanProgress.total > 0 && (
                    <div className="progress-container" style={{ width: '100%', maxWidth: '400px' }}>
                      <div className="flex-between text-xs text-sec">
                        <span>ETA: {scanProgress.etaStr}</span>
                        <span>{scanProgress.current} / {scanProgress.total}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}></div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {filteredMedia.length > 0 && !scanning && (
                <div style={{ padding: '0 8px 12px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isCategoryAllSelected}
                      onChange={toggleCategorySelection}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)' }}
                    />
                    <span className="text-sm font-medium">Select All {category === 'all' ? 'Found' : category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}</span>
                  </label>
                  <span className="text-xs text-sec">{selectedFiles.size} of {media.length} selected</span>
                </div>
              )}

              {filteredMedia.length > 0 && !scanning && (
                <div className="media-list">
                  {filteredMedia.map((m, i) => (
                    <div key={i} className="media-item" onClick={() => toggleSelection(m.path)} style={{ cursor: 'pointer', transition: 'background-color 0.2s', backgroundColor: selectedFiles.has(m.path) ? 'rgba(255,255,255,0.05)' : '' }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(m.path)}
                        onChange={() => { }}
                        style={{ marginRight: '16px', width: '16px', height: '16px', accentColor: 'var(--accent-color)', pointerEvents: 'none' }}
                      />
                      <div className="media-info" style={{ flex: 1 }}>
                        <div className="media-icon">
                          {getCategoryIcon(m.category)}
                        </div>
                        <div className="media-details">
                          <h4>{m.title}</h4>
                          <p>{m.artist} • {m.album}</p>
                        </div>
                      </div>
                      <div className="text-xs text-sec">
                        {formatBytes(m.size)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; }
      `}} />
    </>
  );
}

export default App;
