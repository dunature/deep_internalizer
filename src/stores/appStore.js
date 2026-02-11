/**
 * Deep Internalizer - App Store (Zustand)
 * Central state management with persistence
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getPendingWords, getLatestSession } from '../db/schema';

export const useAppStore = create(
    persist(
        (set, get) => ({
            // Current state
            currentDocId: null,
            currentChunkIndex: 0,
            currentStep: 1,
            isDebtCleared: true,
            pendingWordCount: 0,
            emergencyAccessLeft: 3,

            // UI state
            isLoading: false,
            showLayer0: true,

            // Actions
            setLoading: (isLoading) => set({ isLoading }),

            setCurrentDocument: (docId) => set({
                currentDocId: docId,
                currentChunkIndex: 0,
                currentStep: 1,
                showLayer0: true
            }),

            setCurrentChunk: (index) => set({
                currentChunkIndex: index,
                showLayer0: false
            }),

            setCurrentStep: (step) => set({ currentStep: step }),

            toggleLayer0: () => set((state) => ({
                showLayer0: !state.showLayer0
            })),

            // Debt checking
            checkDebt: async () => {
                const pendingWords = await getPendingWords();
                const count = pendingWords.length;
                set({
                    pendingWordCount: count,
                    isDebtCleared: count === 0
                });
                return count;
            },

            // Emergency access
            grantEmergencyAccess: () => {
                const { emergencyAccessLeft } = get();
                if (emergencyAccessLeft > 0) {
                    set({
                        emergencyAccessLeft: emergencyAccessLeft - 1,
                        isDebtCleared: true // Temporarily allow access
                    });
                    return true;
                }
                return false;
            },

            // Session restore
            restoreSession: async () => {
                const session = await getLatestSession();
                if (session) {
                    set({
                        currentDocId: session.docId,
                        currentChunkIndex: session.currentChunkIndex,
                        currentStep: session.currentStep || 1
                    });
                    return session;
                }
                return null;
            },

            // Reset
            reset: () => set({
                currentDocId: null,
                currentChunkIndex: 0,
                currentStep: 1,
                showLayer0: true
            })
        }),
        {
            name: 'deep-internalizer-storage',
            partialize: (state) => ({
                emergencyAccessLeft: state.emergencyAccessLeft
            })
        }
    )
);

export default useAppStore;
