
import { describe, it, expect } from 'vitest';
import { getSubdomain } from './subdomain.server';

describe('getSubdomain', () => {
    const BASE = 'studio-platform-dev.slichti.org';

    it('extracts valid subdomain', () => {
        const req = new Request(`https://garden-yoga.${BASE}/`);
        expect(getSubdomain(req)).toBe('garden-yoga');
    });

    it('returns null for root domain', () => {
        const req = new Request(`https://${BASE}/`);
        expect(getSubdomain(req)).toBeNull();
    });

    it('returns null for reserved subdomains', () => {
        const reserved = ['www', 'api', 'admin', 'app', 'mail', 'staging', 'dev', 'test'];
        reserved.forEach(sub => {
            const req = new Request(`https://${sub}.${BASE}/`);
            expect(getSubdomain(req)).toBeNull();
        });
    });

    it('returns the hostname for unrelated domains (custom domains)', () => {
        const req = new Request('https://google.com/');
        expect(getSubdomain(req)).toBe('google.com');
    });

    it('returns the hostname for domains that just end with base but are not subdomains', () => {
        const req = new Request(`https://fake-${BASE}/`);
        expect(getSubdomain(req)).toBe(`fake-${BASE}`);
    });
});
