import React, { useState, useRef, useEffect, useCallback } from 'react';
import { request, getAuthToken } from './api';

// ── File type config ──────────────────────────────────────────
const EXT_CONFIG = {
    '.pdf': { color: '#dc2626', bg: '#fef2f2', label: 'PDF' },
    '.doc': { color: '#2563eb', bg: '#eff6ff', label: 'DOC' },
    '.docx': { color: '#2563eb', bg: '#eff6ff', label: 'DOCX' },
    '.xls': { color: '#16a34a', bg: '#f0fdf4', label: 'XLS' },
    '.xlsx': { color: '#16a34a', bg: '#f0fdf4', label: 'XLSX' },
    '.ppt': { color: '#ea580c', bg: '#fff7ed', label: 'PPT' },
    '.pptx': { color: '#ea580c', bg: '#fff7ed', label: 'PPTX' },
    '.txt': { color: '#475569', bg: '#f8fafc', label: 'TXT' },
    '.md': { color: '#475569', bg: '#f8fafc', label: 'MD' },
    '.json': { color: '#7c3aed', bg: '#faf5ff', label: 'JSON' },
    '.csv': { color: '#0d9488', bg: '#f0fdfa', label: 'CSV' },
    '.xml': { color: '#7c3aed', bg: '#faf5ff', label: 'XML' },
    '.log': { color: '#475569', bg: '#f8fafc', label: 'LOG' },
    '.zip': { color: '#92400e', bg: '#fffbeb', label: 'ZIP' },
    '.rar': { color: '#92400e', bg: '#fffbeb', label: 'RAR' },
    '.7z': { color: '#92400e', bg: '#fffbeb', label: '7Z' },
    '.mp4': { color: '#a21caf', bg: '#fdf4ff', label: 'MP4' },
    '.mov': { color: '#a21caf', bg: '#fdf4ff', label: 'MOV' },
    '.mp3': { color: '#a21caf', bg: '#fdf4ff', label: 'MP3' },
    '.png': { color: '#0369a1', bg: '#eff6ff', label: 'PNG' },
    '.jpg': { color: '#0369a1', bg: '#eff6ff', label: 'JPG' },
    '.jpeg': { color: '#0369a1', bg: '#eff6ff', label: 'JPG' },
    '.gif': { color: '#0369a1', bg: '#eff6ff', label: 'GIF' },
    '.webp': { color: '#0369a1', bg: '#eff6ff', label: 'WEBP' },
    '.svg': { color: '#0369a1', bg: '#eff6ff', label: 'SVG' },
};

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
const TEXT_EXTS = ['.txt', '.md', '.json', '.csv', '.log', '.xml'];
const PDF_EXTS = ['.pdf'];

// ── SVG document icon ─────────────────────────────────────────
function FileIcon({ ext, size = 44 }) {
    const cfg = EXT_CONFIG[ext] || { color: '#6b7280', bg: '#f8fafc', label: (ext || '').replace('.', '').slice(0, 4).toUpperCase() || 'FILE' };
    const label = cfg.label.slice(0, 4);
    return (
        <svg width={size} height={size} viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            {/* Document body */}
            <rect x="2" y="2" width="30" height="40" rx="3" fill={cfg.bg} stroke={cfg.color} strokeWidth="1.5" />
            {/* Folded corner */}
            <path d="M21 2 L32 13 L21 13 Z" fill={cfg.color} opacity="0.25" />
            <path d="M21 2 L21 13 L32 13" fill="none" stroke={cfg.color} strokeWidth="1.5" />
            {/* Coloured label stripe */}
            <rect x="2" y="28" width="30" height="14" rx="0 0 3 3" fill={cfg.color} opacity="0.90" />
            <text
                x="17" y="39"
                textAnchor="middle"
                fontSize={label.length > 3 ? "7" : "8"}
                fontWeight="800"
                fill="white"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                letterSpacing="0.5"
            >{label}</text>
        </svg>
    );
}

// ── Thumbnail: real image for photos, SVG icon for everything else ─
function FileThumbnail({ file }) {
    const [imgError, setImgError] = useState(false);
    if (IMAGE_EXTS.includes(file.ext) && !imgError) {
        return (
            <div style={{ width: 44, height: 44, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)', flexShrink: 0 }}>
                <img
                    src={file.url}
                    alt={file.originalName}
                    onError={() => setImgError(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
            </div>
        );
    }
    return <FileIcon ext={file.ext} />;
}

// ── Utilities ──────────────────────────────────────────────────
function formatBytes(b) {
    if (!b) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
}
function isPreviewable(ext) {
    return [...IMAGE_EXTS, ...PDF_EXTS, ...TEXT_EXTS].includes(ext);
}

// Download via fetch+blob so we can set filename without needing auth on URL
async function triggerDownload(fileUrl, originalName) {
    try {
        // /uploads/ is served as express.static — no auth header needed
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
        alert(`Download failed: ${err.message}`);
    }
}

// ── Main component ────────────────────────────────────────────
export default function Upload() {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const [files, setFiles] = useState([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [deletingSet, setDeletingSet] = useState(new Set()); // filenames currently being deleted

    const [previewFile, setPreviewFile] = useState(null);

    // ── Fetch list ─────────────────────────────────────────────
    const fetchFiles = useCallback(async () => {
        setListLoading(true); setListError('');
        try {
            const data = await request('GET', '/api/files');
            setFiles(data.files || []);
        } catch (err) {
            setListError(err.message || 'Could not load file list.');
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);

    // ── Upload ─────────────────────────────────────────────────
    const handleDragOver = (e) => { e.preventDefault(); setDragOver(true); };
    const handleDragLeave = () => setDragOver(false);
    const handleDrop = (e) => {
        e.preventDefault(); setDragOver(false); setUploadError('');
        if (e.dataTransfer.files?.[0]) validateAndSet(e.dataTransfer.files[0]);
    };
    const handleFileChange = (e) => {
        setUploadError('');
        if (e.target.files?.[0]) validateAndSet(e.target.files[0]);
    };
    const validateAndSet = (f) => {
        if (f.size > 2 * 1024 * 1024) {
            setUploadError('File exceeds 2 MB. Choose a smaller file.'); setFile(null); return;
        }
        setFile(f);
    };
    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) { setUploadError('Select a file first.'); return; }
        setUploading(true); setUploadError('');
        const fd = new FormData();
        fd.append('file', file);
        try {
            await request('POST', '/api/upload', fd);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            await fetchFiles();
        } catch (err) {
            setUploadError(err.message || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    };

    // ── Delete one file ────────────────────────────────────────
    const handleDelete = async (f) => {
        if (!window.confirm(`Delete "${f.originalName}"? This cannot be undone.`)) return;
        setDeletingSet(prev => new Set([...prev, f.filename]));
        try {
            await request('DELETE', `/api/files/${encodeURIComponent(f.filename)}`);
            setFiles(prev => prev.filter(x => x.filename !== f.filename));
            if (previewFile?.filename === f.filename) setPreviewFile(null);
        } catch (err) {
            alert(`Delete failed: ${err.message}`);
        } finally {
            setDeletingSet(prev => { const s = new Set(prev); s.delete(f.filename); return s; });
        }
    };

    // ── Bulk delete all copies of same originalName ────────────
    const handleBulkDelete = async (originalName) => {
        const matches = files.filter(f => f.originalName === originalName);
        if (!window.confirm(`Delete all ${matches.length} copies of "${originalName}"? This cannot be undone.`)) return;

        const allFilenames = new Set(matches.map(m => m.filename));
        setDeletingSet(prev => new Set([...prev, ...allFilenames]));

        // Fire individual DELETEs (no new backend endpoint needed)
        const results = await Promise.allSettled(
            matches.map(m => request('DELETE', `/api/files/${encodeURIComponent(m.filename)}`))
        );
        const failedCount = results.filter(r => r.status === 'rejected').length;

        setFiles(prev => prev.filter(f => !allFilenames.has(f.filename)));
        if (previewFile && allFilenames.has(previewFile.filename)) setPreviewFile(null);
        setDeletingSet(prev => { const s = new Set(prev); allFilenames.forEach(n => s.delete(n)); return s; });

        if (failedCount > 0) alert(`${failedCount} of ${matches.length} deletions failed.`);
    };

    // ── Remove ALL stored files ─────────────────────────────────
    const [clearingAll, setClearingAll] = useState(false);
    const handleRemoveAll = async () => {
        if (files.length === 0) return;
        if (!window.confirm(`Delete all ${files.length} file${files.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;

        setClearingAll(true);
        try {
            const result = await request('DELETE', '/api/files?all=true');
            setFiles([]);
            setPreviewFile(null);
            if (result.deleted !== files.length) {
                // Some files may have changed on disk between list and delete — resync from server
                await fetchFiles();
            }
        } catch (err) {
            alert(`Remove all failed: ${err.message}`);
            await fetchFiles();
        } finally {
            setClearingAll(false);
        }
    };

    // ── Group for duplicate count badge ───────────────────────
    const nameCounts = {};
    files.forEach(f => { nameCounts[f.originalName] = (nameCounts[f.originalName] || 0) + 1; });

    // ── Render ─────────────────────────────────────────────────
    return (
        <div className="orders-container">
            <div className="page-header">
                <div>
                    <h1>File Storage</h1>
                    <p className="subtitle">Upload, preview, and download stored attachments ({files.length} file{files.length !== 1 ? 's' : ''})</p>
                </div>
            </div>

            <div className="upload-page-grid">
                {/* ── Left: Upload panel ─────────────────────────── */}
                <div className="card upload-panel">
                    <div className="card-header border-bottom">
                        <h3>Upload New File</h3>
                        <p className="subtitle">Drag & drop or click to browse — max 2 MB</p>
                    </div>

                    {uploadError && <div className="message-box error-box" style={{ marginTop: 16 }}>{uploadError}</div>}

                    <form onSubmit={handleUpload} style={{ marginTop: 16 }}>
                        <div
                            className={`dropzone ${dragOver ? 'dragover' : ''} ${file ? 'has-file' : ''}`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} disabled={uploading} />
                            <span className="dropzone-icon">{file ? '📄' : '📤'}</span>
                            {file ? (
                                <>
                                    <p className="dropzone-text font-weight-600">{file.name}</p>
                                    <span className="dropzone-subtext">{formatBytes(file.size)} — click to change</span>
                                </>
                            ) : (
                                <>
                                    <p className="dropzone-text">Drop a file, or <span style={{ textDecoration: 'underline' }}>click to browse</span></p>
                                    <span className="dropzone-subtext">Any file type up to 2 MB</span>
                                </>
                            )}
                        </div>
                        <button type="submit" className="btn-primary" disabled={!file || uploading} style={{ width: '100%', marginTop: 12 }}>
                            {uploading ? 'Uploading...' : 'Upload File'}
                        </button>
                    </form>
                </div>

                {/* ── Right: File gallery ───────────────────────── */}
                <div className="upload-gallery-pane">
                    <div className="gallery-header">
                        <h3>Stored Files</h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-secondary btn-sm" onClick={fetchFiles} disabled={listLoading}>
                                {listLoading ? 'Loading...' : 'Refresh'}
                            </button>
                            <button
                                className="btn-secondary btn-sm danger-btn"
                                onClick={handleRemoveAll}
                                disabled={listLoading || clearingAll || files.length === 0}
                                title="Delete every stored file"
                            >
                                {clearingAll ? 'Removing...' : `Remove All (${files.length})`}
                            </button>
                        </div>
                    </div>

                    {listError && (
                        <div className="message-box error-box" style={{ marginBottom: 16 }}>
                            {listError}
                            <button className="btn-secondary btn-sm" onClick={fetchFiles} style={{ marginTop: 8 }}>Retry</button>
                        </div>
                    )}

                    {listLoading ? (
                        <div className="file-list-skeleton">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="skeleton-row">
                                    <div className="skeleton-cell w-60" />
                                    <div className="skeleton-cell w-20" />
                                </div>
                            ))}
                        </div>
                    ) : files.length === 0 ? (
                        <div className="empty-state" style={{ padding: '48px 24px' }}>
                            <div className="empty-icon">🗂️</div>
                            <h3>No files stored yet</h3>
                            <p>Upload your first file using the panel on the left.</p>
                        </div>
                    ) : (
                        <div className="file-list">
                            {files.map(f => {
                                const count = nameCounts[f.originalName];
                                const isDuplicate = count > 1;
                                const isDeleting = deletingSet.has(f.filename);
                                return (
                                    <div key={f.filename} className={`file-row ${previewFile?.filename === f.filename ? 'file-row-active' : ''} ${isDeleting ? 'file-row-fading' : ''}`}>
                                        {/* Icon / thumbnail */}
                                        <FileThumbnail file={f} />

                                        {/* Meta */}
                                        <div className="file-meta">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                                <span className="file-name" title={f.originalName}>{f.originalName}</span>
                                                {isDuplicate && (
                                                    <span
                                                        className="dup-badge"
                                                        title={`${count} duplicates — click Clear ×${count} to remove all`}
                                                    >×{count}</span>
                                                )}
                                            </div>
                                            <span className="file-detail">
                                                {formatBytes(f.size)} · {new Date(f.uploadedAt).toLocaleDateString()} {new Date(f.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <div className="file-actions">
                                            {isPreviewable(f.ext) && (
                                                <button
                                                    className="btn-secondary btn-sm"
                                                    onClick={() => setPreviewFile(previewFile?.filename === f.filename ? null : f)}
                                                >
                                                    {previewFile?.filename === f.filename ? 'Close' : 'Preview'}
                                                </button>
                                            )}
                                            {/* JS-triggered download — no auth header issue */}
                                            <button
                                                className="btn-secondary btn-sm"
                                                onClick={() => triggerDownload(f.url, f.originalName)}
                                                title="Download file"
                                            >
                                                ↓ Save
                                            </button>
                                            {isDuplicate && (
                                                <button
                                                    className="btn-secondary btn-sm danger-btn"
                                                    onClick={() => handleBulkDelete(f.originalName)}
                                                    disabled={isDeleting}
                                                    title={`Delete all ${count} copies of this file`}
                                                >
                                                    Clear ×{count}
                                                </button>
                                            )}
                                            <button
                                                className="btn-secondary btn-sm danger-btn"
                                                onClick={() => handleDelete(f)}
                                                disabled={isDeleting}
                                                title="Delete this file"
                                            >
                                                {isDeleting ? '...' : 'Delete'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Preview panel ─────────────────────────────────── */}
            {previewFile && (
                <div className="preview-panel card" style={{ marginTop: 24 }}>
                    <div className="preview-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <FileIcon ext={previewFile.ext} size={36} />
                            <div>
                                <h3 style={{ margin: 0 }}>{previewFile.originalName}</h3>
                                <p className="subtitle">{formatBytes(previewFile.size)}</p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="btn-primary btn-sm"
                                onClick={() => triggerDownload(previewFile.url, previewFile.originalName)}
                            >
                                ↓ Download
                            </button>
                            <button className="btn-secondary btn-sm" onClick={() => setPreviewFile(null)}>Close</button>
                        </div>
                    </div>
                    <div className="preview-body">
                        {IMAGE_EXTS.includes(previewFile.ext) && (
                            <img src={previewFile.url} alt={previewFile.originalName} className="preview-image" />
                        )}
                        {PDF_EXTS.includes(previewFile.ext) && (
                            <iframe src={previewFile.url} title={previewFile.originalName} className="preview-iframe" />
                        )}
                        {TEXT_EXTS.includes(previewFile.ext) && <TextPreview url={previewFile.url} />}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Async text renderer ───────────────────────────────────────
function TextPreview({ url }) {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        // /uploads/ static — no auth required
        fetch(url)
            .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
            .then(t => { setText(t); setLoading(false); })
            .catch(e => { setError(e.message); setLoading(false); });
    }, [url]);

    if (loading) return <p style={{ padding: 16, color: 'var(--color-text-tertiary)' }}>Loading content...</p>;
    if (error) return <p style={{ padding: 16, color: 'var(--color-error)' }}>Could not load: {error}</p>;
    return <pre className="text-preview">{text}</pre>;
}