/**
 * Launch Interception Component
 * Blocks access to new content until vocabulary debt is cleared
 */
import { useState } from 'react';
import styles from './LaunchInterception.module.css';

export default function LaunchInterception({
    pendingCount,
    emergencyAccessLeft,
    onClearDebt,
    onEmergencyAccess
}) {
    const [showConfirm, setShowConfirm] = useState(false);

    const handleEmergencyClick = () => {
        if (emergencyAccessLeft > 0) {
            setShowConfirm(true);
        }
    };

    const confirmEmergency = () => {
        setShowConfirm(false);
        onEmergencyAccess();
    };

    return (
        <div className={styles.container}>
            <div className={styles.lockIcon}>🔒</div>

            <h1 className={styles.title}>Content Locked</h1>

            <p className={styles.message}>
                You have <span className={styles.count}>{pendingCount}</span> words pending review.
                <br />
                Clear your context debt before accessing new content.
            </p>

            <button
                className={`btn btn-primary btn-large ${styles.primaryAction}`}
                onClick={onClearDebt}
            >
                Clear Context Debt ({pendingCount})
            </button>

            {emergencyAccessLeft > 0 && (
                <button
                    className={`btn btn-ghost ${styles.emergencyLink}`}
                    onClick={handleEmergencyClick}
                >
                    Emergency Access ({emergencyAccessLeft}/3 remaining)
                </button>
            )}

            {showConfirm && (
                <div className="overlay" onClick={() => setShowConfirm(false)}>
                    <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
                        <h3>Use Emergency Access?</h3>
                        <p className="text-muted">
                            This is a limited privilege designed for urgent situations.
                            You have {emergencyAccessLeft} uses remaining this year.
                        </p>
                        <div className={styles.confirmActions}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={confirmEmergency}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
