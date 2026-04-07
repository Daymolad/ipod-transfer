import { useState, useEffect } from 'react';
import axios from 'axios';
import { HardDrive, Music, Mic, Image as ImageIcon, FolderArchive, ArrowRight, CheckCircle2, Loader2, PlayCircle, Video, Search } from 'lucide-react';
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
      const response = await fetch(`${API_BASE}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      case 'music': return <Music size={20} />;
      case 'podcast': return <PlayCircle size={20} />;
      case 'voice_recording': return <Mic size={20} />;
      case 'photo': return <ImageIcon size={20} />;
      case 'video': return <Video size={20} />;
      default: return <FolderArchive size={20} />;
    }
  };

  const filteredMedia = getFilteredMedia();
  const selectedFilesList = media.filter(m => selectedFiles.has(m.path));
  const summary = selectedFilesList.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <>
      <header className="header-nav">
        <div className="header-logo">
          <HardDrive size={16} /> 
          <span style={{fontWeight: 600}}>iPod Toolkit</span>
        </div>
        <div>Mac</div>
      </header>

      <main className="section section-light" style={{ padding: '40px 24px', flex: 1 }}>
        <div className="container-inner" style={{ maxWidth: '1200px' }}>
          
          <div className="grid-2">
            {/* Left Column: Setup & Transfer Settings */}
            <div className="apple-card" style={{ display: 'flex', flexDirection: 'column', gap: '48px', margin: 0 }}>
              
              <div>
                <h1 className="section-heading mb-4">Toolkit.</h1>
                <p className="body-text text-sec mb-8">Scan your device to recover its media.</p>

                <div className="apple-input-group">
                  <label>Select Device Volume</label>
                  <select
                    className="apple-select"
                    value={selectedPath}
                    onChange={(e) => setSelectedPath(e.target.value)}
                  >
                    <option value="">-- Choose Volume --</option>
                    {volumes.map(v => (
                      <option key={v.path} value={v.path}>
                        {v.name} {v.isIpod ? '(iPod Detected)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="apple-input-group mb-8">
                  <label>Custom Source Path (Optional)</label>
                  <input
                    type="text"
                    className="apple-input"
                    value={selectedPath}
                    onChange={(e) => setSelectedPath(e.target.value)}
                    placeholder="/Volumes/My iPod"
                  />
                </div>

                <button
                  className="btn-apple-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  onClick={handleScan}
                  disabled={scanning || !selectedPath}
                >
                  {scanning ? <><Loader2 className="spinner" size={20} /> Deep Scanning...</> : 'Scan Device Sectors'}
                </button>

                {scanning && scanProgress.total > 0 && (
                  <div className="apple-progress-container mt-4">
                    <div className="flex-between caption text-sec">
                      <span>ETA: {scanProgress.etaStr}</span>
                      <span>{scanProgress.current} of {scanProgress.total}</span>
                    </div>
                    <div className="apple-progress-bar">
                      <div className="apple-progress-fill" style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}></div>
                    </div>
                    <div className="caption text-sec mt-2" style={{ textAlign: 'center', minHeight: '20px' }}>
                      {scanProgress.file}
                    </div>
                  </div>
                )}
              </div>

              {media.length > 0 && (
                <div style={{ paddingTop: '40px', borderTop: '1px solid #d2d2d7' }}>
                  <h2 className="tile-heading mb-8">Extract</h2>
                  
                  <div className="apple-input-group mb-8">
                     <label>Destination Folder</label>
                    <input
                      type="text"
                      className="apple-input"
                      value={destPath}
                      onChange={(e) => setDestPath(e.target.value)}
                    />
                  </div>

                  <button
                    className="btn-apple-primary"
                    style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                    onClick={startTransfer}
                    disabled={transferring || selectedFiles.size === 0}
                  >
                    {transferring ? 'Transferring...' : `Copy ${selectedFiles.size} items (${formatBytes(summary)})`}
                  </button>

                  {transferring && (
                     <div className="apple-progress-container mt-8">
                       <div className="flex-between caption text-sec">
                         <span style={{ maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                           {currentFile || 'Initiating...'}
                         </span>
                         <span>{progress} / {totalFiles} completed</span>
                       </div>
                       <div className="apple-progress-bar">
                         <div className="apple-progress-fill" style={{ width: `${(progress / totalFiles) * 100}%` }}></div>
                       </div>
                     </div>
                  )}

                  {transferComplete && (
                    <div className="flex-between mt-8" style={{ color: '#10b981', justifyContent: 'center', gap: '8px' }}>
                      <CheckCircle2 size={24} />
                      <span className="body-emphasis">Extraction Complete!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Media Viewer */}
            <div className="apple-card" style={{ margin: 0, height: 'calc(100vh - 128px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               <h2 className="tile-heading mb-8">Discovered Media</h2>
               
               <div className="apple-tabs" style={{ justifyContent: 'flex-start' }}>
                 {['all', 'music', 'podcast', 'voice_recording', 'photo', 'video'].map(c => (
                   <button
                     key={c}
                     className={`apple-tab ${category === c ? 'active' : ''}`}
                     onClick={() => setCategory(c)}
                     style={{ textTransform: 'capitalize' }}
                   >
                     {c.replace('_', ' ')}
                   </button>
                 ))}
               </div>

               <div style={{ flex: 1, overflowY: 'auto' }}>
                 {media.length === 0 && !scanning && (
                    <div className="flex-center text-sec" style={{ height: '100%', flexDirection: 'column', gap: '16px' }}>
                      <FolderArchive size={48} opacity={0.3} />
                      <p className="body-text">No media discovered yet. Scan a device to begin.</p>
                    </div>
                  )}
                  
                  {scanning && (
                    <div className="flex-center text-sec" style={{ height: '100%', flexDirection: 'column', gap: '24px' }}>
                      <Loader2 size={48} className="spinner" style={{ color: 'var(--apple-blue)' }} />
                    </div>
                  )}

                  {filteredMedia.length > 0 && !scanning && (
                    <>
                      <div className="flex-between mb-4" style={{ padding: '0 8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isCategoryAllSelected}
                            onChange={toggleCategorySelection}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--apple-blue)' }}
                          />
                          <span className="body-emphasis">Select All</span>
                        </label>
                        <span className="body-text text-sec">{selectedFiles.size} of {media.length} items</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredMedia.map((m, i) => (
                           <div 
                             key={i} 
                             onClick={() => toggleSelection(m.path)} 
                             style={{ 
                               display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 16px',
                               borderRadius: '8px', cursor: 'pointer', transition: 'background-color 0.2s',
                               backgroundColor: selectedFiles.has(m.path) ? 'rgba(0, 113, 227, 0.05)' : 'transparent'
                             }}
                           >
                             <input
                               type="checkbox"
                               checked={selectedFiles.has(m.path)}
                               onChange={() => { }}
                               style={{ width: '18px', height: '18px', accentColor: 'var(--apple-blue)', pointerEvents: 'none' }}
                             />
                             <div style={{ color: 'var(--text-tertiary-light)' }}>
                               {getCategoryIcon(m.category)}
                             </div>
                             <div style={{ flex: 1, minWidth: 0 }}>
                               <div className="body-emphasis" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                 {m.title}
                               </div>
                               <div className="caption text-sec" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                 {m.artist} • {m.album}
                               </div>
                             </div>
                             <div className="caption text-sec" style={{ whiteSpace: 'nowrap' }}>
                                {formatBytes(m.size)}
                             </div>
                           </div>
                        ))}
                      </div>
                    </>
                  )}
               </div>
            </div>

          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; }
        
        /* Modern scrollbar for media viewer */
        ::-webkit-scrollbar { width: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d2d2d7; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #a1a1a6; }
      `}} />
    </>
  );
}

export default App;
