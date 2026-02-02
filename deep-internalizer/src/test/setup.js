import '@testing-library/jest-dom';
import { vi } from 'vitest';
import 'fake-indexeddb/auto';

// Mock fetch for Ollama API calls
global.fetch = vi.fn();
