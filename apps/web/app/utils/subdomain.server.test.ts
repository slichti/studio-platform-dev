
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

    it('returns null for unrelated domains', () => {
        const req = new Request('https://google.com/');
        expect(getSubdomain(req)).toBeNull();
    });

    it('returns null for domains that just end with base but are not subdomains', () => {
        // e.g. "not-studio-platform-dev.slichti.org" is technically a different domain if we consider the dot
        // depending on logic.
        // The implementation: hostname.endsWith(BASE_DOMAIN)
        // "fake-studio-platform-dev.slichti.org".endsWith(...) -> True
        // .replace -> "fake-"
        // This test case ensures we handle the dot check if necessary.
        // Current implementation: hostname.replace(`.${BASE_DOMAIN}`, '')
        // If hostname is "fake-studio-platform-dev.slichti.org", replace returns "fake-studio-platform-dev.slichti.org" because pattern includes leading dot.
        // Wait, `.${BASE_DOMAIN}` matches ".studio-platform-dev.slichti.org".
        // "fake-studio-platform-dev.slichti.org" does NOT contain ".studio-platform-dev..."

        const req = new Request(`https://fake-${BASE}/`);
        expect(getSubdomain(req)).toBeNull();
    });
});
