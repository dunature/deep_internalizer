/**
 * PWA Install Prompt Component
 * Shows install banner when PWA is installable
 */
import { useState, useEffect } from 'react';
import styles from './PWAPrompt.module.css';

export default function PWAPrompt() {
    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(() =>
        window.matchMedia('(display-mode: standalone)').matches
    );
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        if (isInstalled) return;

        // Listen for install prompt
        const handleBeforeInstall = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
            // Show prompt after 30 seconds of use
            setTimeout(() => setShowPrompt(true), 30000);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Listen for successful install
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setShowPrompt(false);
            setInstallPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, [isInstalled]);

    const handleInstall = async () => {
        if (!installPrompt) return;

        installPrompt.prompt();
        const result = await installPrompt.userChoice;

        if (result.outcome === 'accepted') {
            setInstallPrompt(null);
            setShowPrompt(false);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        // Don't show again for this session
        sessionStorage.setItem('pwa-prompt-dismissed', 'true');
    };

    // Don't show if already installed or dismissed
    if (isInstalled || !showPrompt || !installPrompt) return null;
    if (sessionStorage.getItem('pwa-prompt-dismissed')) return null;

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <span className={styles.icon}>📱</span>
                <div className={styles.text}>
                    <strong>Install Deep Internalizer</strong>
                    <span>Access your learning offline</span>
                </div>
            </div>
            <div className={styles.actions}>
                <button className="btn btn-ghost" onClick={handleDismiss}>
                    Later
                </button>
                <button className="btn btn-primary" onClick={handleInstall}>
                    Install
                </button>
            </div>
        </div>
    );
}
