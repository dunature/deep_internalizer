/**
 * Layer 0: Global Blueprint Component
 * Shows document overview with semantic chunks and progress
 * 1:1 Replica of Pencil Design (6cjsL / lReeq)
 */
import { useMemo } from 'react';
import styles from './GlobalBlueprint.module.css';
import { useAppStore } from '../../stores/appStore';

export default function GlobalBlueprint({
    document,
    chunks,
    onChunkSelect,
    currentChunkIndex,
    onShowImport,
    onShowProfile
}) {
    const theme = useAppStore(state => state.theme);
    const toggleTheme = useAppStore(state => state.toggleTheme);

    const totalProgress = useMemo(() => {
        if (!chunks || chunks.length === 0) return 0;
        const completed = chunks.filter(c => c.completed).length;
        return Math.round((completed / chunks.length) * 100);
    }, [chunks]);

    const completedCount = chunks?.filter(c => c.completed).length || 0;
    const totalCount = chunks?.length || 0;

    if (!document) {
        return (
            <div className={styles.empty}>
                <p>No document loaded</p>
            </div>
        );
    }

    return (
        <div className={`${styles.container} ${theme === 'dark' ? styles.darkTheme : ''}`}>
            {/* 1:1 Top Nav (MvLdU / embCk) */}
            <nav className={styles.topNav}>
                <div className={styles.navInner}>
                    <div className={styles.navLeft}>
                        <div className={styles.crumb}>Global Map &gt; Chunk Set A</div>
                        <button className={styles.back} onClick={() => window.history.back()}>
                            ← Back to course map
                        </button>
                    </div>
                    
                    <h1 className={styles.navTitle}>Deep Internalizer — Global Map</h1>
                    
                    <div className={styles.navRight}>
                        <button className={styles.importBtn} onClick={onShowImport}>Import</button>
                        <button className={styles.profileBtn} onClick={onShowProfile}>Profile</button>
                        <button className={styles.themeToggle} onClick={toggleTheme}>Theme</button>
                    </div>
                </div>
            </nav>

            {/* 1:1 Body Layout (mCf2J / wvnpc) */}
            <main className={styles.body}>
                {/* Map Column (B7vbV / 7VyDu) */}
                <div className={styles.mapCol}>
                    <div className={styles.mapCard}>
                        <div className={styles.mapHead}>
                            <h2 className={styles.mapTitle}>Learning Path Chunks</h2>
                            <div className={styles.progressChip}>
                                {completedCount} of {totalCount} completed
                            </div>
                        </div>

                        <div className={styles.chunkRow}>
                            {chunks.map((chunk, index) => (
                                <div 
                                    key={chunk.id} 
                                    className={`${styles.chunkNode} ${index === currentChunkIndex ? styles.inProgress : ''} ${chunk.completed ? styles.completed : ''}`}
                                    onClick={() => onChunkSelect(index)}
                                >
                                    <div className={styles.chunkText}>
                                        {`Chunk ${index + 1}\n${chunk.title}\nStatus: ${chunk.completed ? 'Done' : (index === currentChunkIndex ? 'In Progress' : 'Queued')}`}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={styles.progressRail}>
                            <div className={styles.railLbl}>Current Sequence Progress</div>
                            <div className={styles.railTrack}>
                                <div 
                                    className={styles.railVal} 
                                    style={{ width: `${totalProgress}%` }}
                                />
                            </div>
                        </div>

                        <div className={styles.statusRow}>
                            <div className={`${styles.statusItem} ${styles.stDone}`}>Done {completedCount}</div>
                            <div className={`${styles.statusItem} ${styles.stNow}`}>Now 1</div>
                            <div className={`${styles.statusItem} ${styles.stQueued}`}>Queued {totalCount - completedCount - 1}</div>
                        </div>
                    </div>
                </div>

                {/* Side Column (58pTf / lkTTX) */}
                <div className={styles.sideCol}>
                    <div className={styles.docCard}>
                        <h3 className={styles.docTitle}>Doc Card</h3>
                        <p className={styles.docName}>{document.title}</p>
                        <p className={styles.docMeta}>{totalCount} chunks • Last sync 12m ago</p>
                        <div className={styles.actionRow}>
                            <button className={styles.newBtn} onClick={onShowImport}>New Chunk</button>
                            <button className={styles.importBtn2} onClick={onShowImport}>Import Doc</button>
                        </div>
                    </div>

                    <div className={styles.profileCard}>
                        <span className={styles.profileName}>Lin · Learning Session</span>
                        <span className={styles.profileOpen}>Open Profile</span>
                    </div>
                </div>
            </main>
        </div>
    );
}
