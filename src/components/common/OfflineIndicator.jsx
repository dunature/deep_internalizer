/**
 * Offline Status Indicator
 * Shows when app is offline
 */
import { useState, useEffect } from 'react';
import styles from './OfflineIndicator.module.css';

export default function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            // Show "back online" briefly
            setShowBanner(true);
            setTimeout(() => setShowBanner(false), 3000);
        };

        const handleOffline = () => {
            setIsOffline(true);
            setShowBanner(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!showBanner) return null;

    return (
        <div className={`${styles.banner} ${isOffline ? styles.offline : styles.online}`}>
            {isOffline ? (
                <>
                    <span className={styles.icon}>📡</span>
                    <span>You're offline. Some features may be limited.</span>
                </>
            ) : (
                <>
                    <span className={styles.icon}>✓</span>
                    <span>Back online</span>
                </>
            )}
        </div>
    );
}
