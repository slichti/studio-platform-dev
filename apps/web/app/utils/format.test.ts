import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration } from './format';

describe('formatBytes', () => {
    it('should format 0 bytes', () => {
        expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format KB', () => {
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1500)).toBe('1.46 KB');
    });

    it('should format MB', () => {
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
        expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });

    it('should format GB', () => {
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should handle decimals argument', () => {
        expect(formatBytes(1500, 0)).toBe('1 KB');
        expect(formatBytes(1500, 3)).toBe('1.465 KB');
    });
});

describe('formatDuration', () => {
    it('should format 0 seconds', () => {
        expect(formatDuration(0)).toBe('0:00');
    });

    it('should format seconds only', () => {
        expect(formatDuration(30)).toBe('0:30');
        expect(formatDuration(9)).toBe('0:09');
    });

    it('should format minutes', () => {
        expect(formatDuration(60)).toBe('1:00');
        expect(formatDuration(65)).toBe('1:05');
        expect(formatDuration(125)).toBe('2:05');
    });

    it('should format large durations', () => {
        expect(formatDuration(3600)).toBe('60:00'); // 60 minutes
    });
});
