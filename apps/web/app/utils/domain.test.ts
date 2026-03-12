import { describe, it, expect } from 'vitest';
import { getTenantUrl } from './domain';

describe('getTenantUrl', () => {
    it('returns custom domain as-is when it starts with http', () => {
        expect(getTenantUrl({ slug: 'x', customDomain: 'https://mystudio.com' })).toBe('https://mystudio.com');
        expect(getTenantUrl({ slug: 'x', customDomain: 'http://localhost:3000' })).toBe('http://localhost:3000');
    });

    it('adds https when custom domain is a hostname', () => {
        expect(getTenantUrl({ slug: 'x', customDomain: 'mystudio.com' })).toBe('https://mystudio.com');
    });

    it('returns platform subdomain URL when no custom domain', () => {
        const url = getTenantUrl({ slug: 'garden-yoga' });
        expect(url).toBe('https://garden-yoga.studio-platform-dev.slichti.org');
    });

    it('ignores slug when custom domain is set', () => {
        expect(getTenantUrl({ slug: 'any', customDomain: 'https://other.com' })).toBe('https://other.com');
    });
});
