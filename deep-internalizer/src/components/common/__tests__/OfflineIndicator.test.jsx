import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OfflineIndicator from '../OfflineIndicator';

describe('OfflineIndicator', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    it('should not render anything when online initially', () => {
        // Mock navigator.onLine as true
        Object.defineProperty(navigator, 'onLine', { writable: true, value: true });

        const { container } = render(<OfflineIndicator />);
        expect(container.firstChild).toBeNull();
    });

    it('should show offline banner when offline event triggers', () => {
        render(<OfflineIndicator />);

        act(() => {
            window.dispatchEvent(new Event('offline'));
        });

        expect(screen.getByText(/You're offline/i)).toBeInTheDocument();
    });

    it('should show back online banner and then hide it', () => {
        render(<OfflineIndicator />);

        act(() => {
            window.dispatchEvent(new Event('online'));
        });

        expect(screen.getByText(/Back online/i)).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(screen.queryByText(/Back online/i)).not.toBeInTheDocument();
    });
});
