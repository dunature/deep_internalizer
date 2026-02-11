/**
 * User Profile Page Component
 * Shows heatmap, stats, and data management
 */
import { useState, useEffect } from 'react';
import Heatmap from './Heatmap';
import { db } from '../../db/schema';
import { getLLMConfig, saveLLMConfig } from '../../services/llmClient';
import styles from './UserProfile.module.css';

export default function UserProfile({ onBack }) {
    const [stats, setStats] = useState({
        totalDocuments: 0,
        totalChunksCompleted: 0,
        totalWords: 0,
        totalWordsArchived: 0,
        totalWordsPending: 0,
        totalReviews: 0
    });
    const [heatmapData, setHeatmapData] = useState({});
    const [dataCounts, setDataCounts] = useState({
        documents: 0,
        chunks: 0,
        words: 0,
        reviewRecords: 0,
        readingSessions: 0,
        userStats: 0,
        wordAudio: 0,
        syllableAudio: 0,
        chunkKeywords: 0,
        sentenceTranslations: 0,
        analysisCache: 0,
        thoughtGroups: 0,
        cacheTotal: 0
    });
    const [isExporting, setIsExporting] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [loadError, setLoadError] = useState('');
    const [exportPreview, setExportPreview] = useState('');
    const [showExportPreview, setShowExportPreview] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [llmConfig, setLlmConfig] = useState({
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.1:latest',
        apiKey: ''
    });

    useEffect(() => {
        refreshAll();
        setLlmConfig(getLLMConfig());
    }, []);

    const formatDexieError = (error) => {
        if (!error) return 'Unknown database error';
        const name = error?.name || 'DexieError';
        const message = error?.message || 'Database operation failed';
        return `${name}: ${message}`;
    };

    const ensureDbOpen = async () => {
        try {
            await db.open();
            return true;
        } catch (error) {
            console.error('Dexie open failed:', error);
            setLoadError(formatDexieError(error));
            return false;
        }
    };

    const refreshAll = async () => {
        setIsRefreshing(true);
        setLoadError('');
        try {
            const ok = await ensureDbOpen();
            if (!ok) return;

            const results = await Promise.allSettled([
                loadStats(),
                loadHeatmapData(),
                loadDataCounts()
            ]);

            const failed = results.filter(result => result.status === 'rejected');
            if (failed.length > 0) {
                console.error('Profile refresh failed:', failed);
                setLoadError('Some profile data could not be loaded. Try refresh.');
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    const loadStats = async () => {
        const [
            documents,
            completedChunks,
            totalWords,
            archivedWords,
            pendingWords,
            totalReviews
        ] = await Promise.all([
            db.documents.count(),
            db.chunks.filter(chunk => chunk.completed === true).count(),
            db.words.count(),
            db.words.where('status').equals('archived').count(),
            db.words.where('status').equals('pending').count(),
            db.reviewRecords.count()
        ]);

        setStats({
            totalDocuments: documents,
            totalChunksCompleted: completedChunks,
            totalWords,
            totalWordsArchived: archivedWords,
            totalWordsPending: pendingWords,
            totalReviews
        });
    };

    const loadHeatmapData = async () => {
        const [words, chunks, userStats, documents] = await Promise.all([
            db.words.toArray(),
            db.chunks.toArray(),
            db.userStats.toArray(),
            db.documents.toArray()
        ]);

        const data = {};
        const docDates = new Map();
        documents.forEach(doc => {
            const date = doc.lastAccessedAt || doc.importedAt;
            if (doc.id && date) {
                docDates.set(doc.id, date);
            }
        });
        const bump = (date, key) => {
            if (!date) return;
            const dateKey = date.split('T')[0];
            if (!data[dateKey]) {
                data[dateKey] = { segments: 0, words: 0 };
            }
            data[dateKey][key] += 1;
        };

        words.forEach(word => {
            const date = word.archivedAt || word.addedAt;
            bump(date, 'words');
        });

        chunks.forEach(chunk => {
            if (!chunk.completed) return;
            const date = chunk.completedAt || docDates.get(chunk.docId);
            bump(date, 'segments');
        });

        if (userStats.length > 0) {
            userStats.forEach(s => {
                const existing = data[s.date];
                const existingTotal = existing ? (existing.segments || 0) + (existing.words || 0) : 0;
                const incomingTotal = (s.segments || 0) + (s.words || 0);
                if (!existing || existingTotal === 0) {
                    data[s.date] = { segments: s.segments || 0, words: s.words || 0 };
                } else if (incomingTotal > existingTotal) {
                    data[s.date] = { segments: s.segments || 0, words: s.words || 0 };
                }
            });
        }

        setHeatmapData(data);
    };

    const loadDataCounts = async () => {
        const hasTable = (name) => db.tables.some(table => table.name === name);
        const safeCount = async (name) => {
            if (!hasTable(name)) return 0;
            return db[name].count();
        };

        const [
            documents,
            chunks,
            words,
            reviewRecords,
            readingSessions,
            userStats,
            wordAudio,
            syllableAudio,
            chunkKeywords,
            sentenceTranslations,
            analysisCache,
            thoughtGroups
        ] = await Promise.all([
            safeCount('documents'),
            safeCount('chunks'),
            safeCount('words'),
            safeCount('reviewRecords'),
            safeCount('readingSessions'),
            safeCount('userStats'),
            safeCount('wordAudio'),
            safeCount('syllableAudio'),
            safeCount('chunkKeywords'),
            safeCount('sentenceTranslations'),
            safeCount('analysisCache'),
            safeCount('thoughtGroups')
        ]);

        const cacheTotal = wordAudio + syllableAudio + chunkKeywords + sentenceTranslations + analysisCache + thoughtGroups;

        setDataCounts({
            documents,
            chunks,
            words,
            reviewRecords,
            readingSessions,
            userStats,
            wordAudio,
            syllableAudio,
            chunkKeywords,
            sentenceTranslations,
            analysisCache,
            thoughtGroups,
            cacheTotal
        });
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const ok = await ensureDbOpen();
            if (!ok) return;

            const fileName = `deep-internalizer-backup-${new Date().toISOString().split('T')[0]}.json`;
            const data = {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                documents: await db.documents.toArray(),
                chunks: await db.chunks.toArray(),
                words: await db.words.toArray(),
                reviewRecords: await db.reviewRecords.toArray(),
                readingSessions: await db.readingSessions.toArray(),
                userStats: await db.userStats.toArray()
            };

            const json = JSON.stringify(data, null, 2);
            setExportPreview(json);
            setShowExportPreview(true);

            // Prefer File System Access API in Chrome for reliable file extension
            if (typeof window !== 'undefined' && window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [
                            {
                                description: 'JSON Backup',
                                accept: { 'application/json': ['.json'] }
                            }
                        ]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(json);
                    await writable.close();
                    alert('Export complete. Your file was saved.');
                    return;
                } catch (err) {
                    if (err?.name !== 'AbortError') {
                        console.warn('Save picker failed, falling back to download:', err);
                    }
                }
            }

            const file = new File([json], fileName, { type: 'application/json' });
            const url = URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            alert('Export complete. Your download should start automatically.');
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    const handleCopyExport = async () => {
        if (!exportPreview) return;
        setIsCopying(true);
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(exportPreview);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = exportPreview;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
            }
            alert('Backup JSON copied to clipboard.');
        } catch (error) {
            console.error('Copy failed:', error);
            alert('Copy failed: ' + error.message);
        } finally {
            setIsCopying(false);
        }
    };

    const handleImport = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const confirmed = confirm(
            'This will replace all existing data. Are you sure you want to continue?'
        );
        if (!confirmed) return;

        try {
            const ok = await ensureDbOpen();
            if (!ok) return;

            const text = await file.text();
            const data = JSON.parse(text);

            // Validate data structure
            if (!data.version || !data.documents) {
                throw new Error('Invalid backup file format');
            }

            // Clear existing data
            await db.documents.clear();
            await db.chunks.clear();
            await db.words.clear();
            await db.reviewRecords.clear();
            await db.readingSessions.clear();
            await db.userStats.clear();
            await db.wordAudio.clear();
            await db.syllableAudio.clear();
            await db.chunkKeywords.clear();
            await db.sentenceTranslations.clear();
            await db.analysisCache.clear();
            await db.thoughtGroups.clear();

            // Import data
            if (data.documents?.length) await db.documents.bulkAdd(data.documents);
            if (data.chunks?.length) await db.chunks.bulkAdd(data.chunks);
            if (data.words?.length) await db.words.bulkAdd(data.words);
            if (data.reviewRecords?.length) await db.reviewRecords.bulkAdd(data.reviewRecords);
            if (data.readingSessions?.length) await db.readingSessions.bulkAdd(data.readingSessions);
            if (data.userStats?.length) await db.userStats.bulkAdd(data.userStats);

            alert('Import successful! Please refresh the page.');
            window.location.reload();
        } catch (error) {
            console.error('Import failed:', error);
            alert('Import failed: ' + error.message);
        }
    };

    const handleClearData = async () => {
        const confirmed = confirm(
            '⚠️ This will permanently delete ALL your data including documents, vocabulary, and progress. This cannot be undone. Are you absolutely sure?'
        );
        if (!confirmed) return;

        const doubleConfirm = confirm('Type "DELETE" in the next prompt to confirm.');
        if (!doubleConfirm) return;

        const input = prompt('Type DELETE to confirm:');
        if (input !== 'DELETE') {
            alert('Deletion cancelled.');
            return;
        }

        try {
            const ok = await ensureDbOpen();
            if (!ok) return;

            await db.documents.clear();
            await db.chunks.clear();
            await db.words.clear();
            await db.reviewRecords.clear();
            await db.readingSessions.clear();
            await db.userStats.clear();
            await db.wordAudio.clear();
            await db.syllableAudio.clear();
            await db.chunkKeywords.clear();
            await db.sentenceTranslations.clear();
            await db.analysisCache.clear();
            await db.thoughtGroups.clear();

            alert('All data cleared. Refreshing...');
            window.location.reload();
        } catch (error) {
            console.error('Clear failed:', error);
            alert('Failed to clear data: ' + error.message);
        }
    };

    const handleLlmConfigChange = (e) => {
        const { name, value } = e.target;
        const newConfig = { ...llmConfig, [name]: value };
        setLlmConfig(newConfig);
        saveLLMConfig(newConfig);
    };

    const handleProviderChange = (e) => {
        const provider = e.target.value;
        let newConfig = { ...llmConfig, provider };

        // Load defaults if switching to a known provider and currently empty or switching from local
        if (provider === 'deepseek' && (!newConfig.baseUrl || newConfig.baseUrl.includes('localhost'))) {
            newConfig.baseUrl = 'https://api.deepseek.com';
            newConfig.model = 'deepseek-chat';
        } else if (provider === 'ollama' && (!newConfig.baseUrl || newConfig.baseUrl.includes('deepseek'))) {
            newConfig.baseUrl = 'http://localhost:11434';
            newConfig.model = 'llama3.1:latest';
        }

        setLlmConfig(newConfig);
        saveLLMConfig(newConfig);
    };

    const handleClearCategory = async (categoryKey) => {
        if (isClearing) return;

        const categories = {
            vocabulary: {
                label: 'Vocabulary & Reviews',
                tables: ['words', 'reviewRecords']
            },
            progress: {
                label: 'Reading Progress',
                tables: ['readingSessions', 'userStats']
            },
            cache: {
                label: 'Caches',
                tables: ['wordAudio', 'syllableAudio', 'chunkKeywords', 'sentenceTranslations', 'analysisCache', 'thoughtGroups']
            }
        };

        const target = categories[categoryKey];
        if (!target) return;

        const confirmed = confirm(`Clear ${target.label}? This cannot be undone.`);
        if (!confirmed) return;

        setIsClearing(true);
        try {
            const ok = await ensureDbOpen();
            if (!ok) return;

            const hasTable = (name) => db.tables.some(table => table.name === name);
            const tables = target.tables.filter(hasTable);
            if (tables.length === 0) {
                alert('No matching data tables found.');
                return;
            }

            await Promise.all(tables.map(table => db[table].clear()));
            await refreshAll();
        } catch (error) {
            console.error('Clear failed:', error);
            alert('Failed to clear data: ' + error.message);
        } finally {
            setIsClearing(false);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <button className="btn btn-ghost" onClick={onBack}>
                    ← Back
                </button>
                <h1>User Profile</h1>
            </header>

            {/* Stats Cards */}
            <section className={styles.statsSection}>
                <div className={styles.statsGrid}>
                    <StatCard
                        icon="📚"
                        value={stats.totalDocuments}
                        label="Documents"
                    />
                    <StatCard
                        icon="✓"
                        value={stats.totalChunksCompleted}
                        label="Chunks Completed"
                    />
                    <StatCard
                        icon="➕"
                        value={stats.totalWords}
                        label="Words Added"
                    />
                    <StatCard
                        icon="📝"
                        value={stats.totalWordsArchived}
                        label="Words Mastered"
                    />
                    <StatCard
                        icon="🔄"
                        value={stats.totalWordsPending}
                        label="Words Pending"
                    />
                    <StatCard
                        icon="🗂️"
                        value={stats.totalReviews}
                        label="Review Actions"
                    />
                </div>
                <div className={styles.refreshRow}>
                    <button
                        className="btn btn-ghost"
                        onClick={refreshAll}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Refreshing...' : '↻ Refresh Stats'}
                    </button>
                    {loadError && (
                        <span className={styles.loadError}>{loadError}</span>
                    )}
                </div>
            </section>

            {/* Heatmap */}
            <section className={styles.heatmapSection}>
                <Heatmap data={heatmapData} />
            </section>

            {/* LLM Settings */}
            <section className={styles.llmSection}>
                <h2>LLM Settings</h2>
                <div className={styles.settingsGrid}>
                    <div className={styles.field}>
                        <label>AI Provider</label>
                        <select
                            name="provider"
                            value={llmConfig.provider}
                            onChange={handleProviderChange}
                            className={styles.select}
                        >
                            <option value="ollama">Ollama (Local)</option>
                            <option value="deepseek">DeepSeek (Cloud)</option>
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label>Base URL</label>
                        <input
                            type="text"
                            name="baseUrl"
                            value={llmConfig.baseUrl}
                            onChange={handleLlmConfigChange}
                            placeholder="e.g. http://localhost:11434"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.field}>
                        <label>Model Name</label>
                        <input
                            type="text"
                            name="model"
                            value={llmConfig.model}
                            onChange={handleLlmConfigChange}
                            placeholder="e.g. llama3.1"
                            className={styles.input}
                        />
                    </div>

                    {llmConfig.provider !== 'ollama' && (
                        <div className={styles.field}>
                            <label>API Key</label>
                            <input
                                type="password"
                                name="apiKey"
                                value={llmConfig.apiKey}
                                onChange={handleLlmConfigChange}
                                placeholder="Enter your API key"
                                className={styles.input}
                            />
                        </div>
                    )}
                </div>
                <p className={styles.hint}>
                    Changes are saved automatically to your local browser storage.
                </p>
            </section>

            {/* Data Management */}
            <section className={styles.dataSection}>
                <h2>Data Management</h2>
                <div className={styles.dataActions}>
                    <button
                        className="btn btn-secondary"
                        onClick={handleExport}
                        disabled={isExporting}
                    >
                        {isExporting ? 'Exporting...' : '📤 Export Backup'}
                    </button>

                    <label className="btn btn-secondary">
                        📥 Import Backup
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            style={{ display: 'none' }}
                        />
                    </label>

                    <button
                        className={`btn btn-ghost ${styles.dangerBtn}`}
                        onClick={handleClearData}
                    >
                        🗑️ Clear All Data
                    </button>
                </div>

                {showExportPreview && exportPreview && (
                    <div className={styles.exportPanel}>
                        <div className={styles.exportHeader}>
                            <h3>Backup JSON</h3>
                            <div className={styles.exportActions}>
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleCopyExport}
                                    disabled={isCopying}
                                >
                                    {isCopying ? 'Copying...' : 'Copy JSON'}
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setShowExportPreview(false)}
                                >
                                    Hide
                                </button>
                            </div>
                        </div>
                        <textarea
                            className={styles.exportTextarea}
                            readOnly
                            value={exportPreview}
                        />
                    </div>
                )}

                <div className={styles.dataGrid}>
                    <div className={styles.dataCard}>
                        <div>
                            <h3>Vocabulary</h3>
                            <p>{dataCounts.words} words · {dataCounts.reviewRecords} reviews</p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleClearCategory('vocabulary')}
                            disabled={isClearing}
                        >
                            Clear Vocabulary
                        </button>
                    </div>
                    <div className={styles.dataCard}>
                        <div>
                            <h3>Progress</h3>
                            <p>{dataCounts.readingSessions} sessions · {dataCounts.userStats} activity days</p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleClearCategory('progress')}
                            disabled={isClearing}
                        >
                            Clear Progress
                        </button>
                    </div>
                    <div className={styles.dataCard}>
                        <div>
                            <h3>Caches</h3>
                            <p>{dataCounts.cacheTotal} cached items</p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleClearCategory('cache')}
                            disabled={isClearing}
                        >
                            Clear Cache
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function StatCard({ icon, value, label }) {
    return (
        <div className={styles.statCard}>
            <span className={styles.statIcon}>{icon}</span>
            <span className={styles.statValue}>{value}</span>
            <span className={styles.statLabel}>{label}</span>
        </div>
    );
}
