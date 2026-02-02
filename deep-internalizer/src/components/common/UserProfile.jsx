/**
 * User Profile Page Component
 * Shows heatmap, stats, and data management
 */
import { useState, useEffect } from 'react';
import Heatmap from './Heatmap';
import { db } from '../../db/schema';
import styles from './UserProfile.module.css';

export default function UserProfile({ onBack }) {
    const [stats, setStats] = useState({
        totalDocuments: 0,
        totalChunksCompleted: 0,
        totalWordsArchived: 0,
        totalWordsPending: 0
    });
    const [heatmapData, setHeatmapData] = useState({});
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        loadStats();
        loadHeatmapData();
    }, []);

    const loadStats = async () => {
        const documents = await db.documents.count();
        const completedChunks = await db.chunks.where('completed').equals(true).count();
        const archivedWords = await db.words.where('status').equals('archived').count();
        const pendingWords = await db.words.where('status').equals('pending').count();

        setStats({
            totalDocuments: documents,
            totalChunksCompleted: completedChunks,
            totalWordsArchived: archivedWords,
            totalWordsPending: pendingWords
        });
    };

    const loadHeatmapData = async () => {
        const userStats = await db.userStats.toArray();
        const data = {};
        userStats.forEach(s => {
            data[s.date] = { segments: s.segments || 0, words: s.words || 0 };
        });
        setHeatmapData(data);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
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

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `deep-internalizer-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed: ' + error.message);
        } finally {
            setIsExporting(false);
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
            await db.documents.clear();
            await db.chunks.clear();
            await db.words.clear();
            await db.reviewRecords.clear();
            await db.readingSessions.clear();
            await db.userStats.clear();

            alert('All data cleared. Refreshing...');
            window.location.reload();
        } catch (error) {
            console.error('Clear failed:', error);
            alert('Failed to clear data: ' + error.message);
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
                        icon="📝"
                        value={stats.totalWordsArchived}
                        label="Words Mastered"
                    />
                    <StatCard
                        icon="🔄"
                        value={stats.totalWordsPending}
                        label="Words Pending"
                    />
                </div>
            </section>

            {/* Heatmap */}
            <section className={styles.heatmapSection}>
                <Heatmap data={heatmapData} />
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
