import { describe, it, expect } from 'vitest';
import { getReconnectDelay } from './chatReconnect';

describe('getReconnectDelay', () => {
    it('returns base delay for first attempt', () => {
        expect(getReconnectDelay(1)).toBe(1000);
        expect(getReconnectDelay(1, 500)).toBe(500);
    });

    it('doubles each attempt up to cap', () => {
        expect(getReconnectDelay(2)).toBe(2000);
        expect(getReconnectDelay(3)).toBe(4000);
        expect(getReconnectDelay(4)).toBe(8000);
        expect(getReconnectDelay(5)).toBe(16000);
        expect(getReconnectDelay(6)).toBe(30000); // cap
        expect(getReconnectDelay(10)).toBe(30000);
    });

    it('respects custom base and cap', () => {
        expect(getReconnectDelay(1, 500, 5000)).toBe(500);
        expect(getReconnectDelay(2, 500, 5000)).toBe(1000);
        expect(getReconnectDelay(5, 500, 5000)).toBe(5000);
        expect(getReconnectDelay(10, 500, 5000)).toBe(5000);
    });
});
