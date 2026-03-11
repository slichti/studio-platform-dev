export type ProfileLike = {
    firstName?: string | null;
    lastName?: string | null;
    [key: string]: any;
} | null;

export function parseProfile(raw: any): ProfileLike {
    if (!raw) return null;
    let value = raw as any;
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    if (typeof value !== 'object') return null;
    return value as ProfileLike;
}

export function getFirstName(raw: any, fallback: string): string {
    const p = parseProfile(raw);
    return (p?.firstName as string | undefined) || fallback;
}

export function getFullName(raw: any, fallback: string): string {
    const p = parseProfile(raw);
    if (!p) return fallback;
    const first = (p.firstName as string | undefined) || '';
    const last = (p.lastName as string | undefined) || '';
    const name = `${first} ${last}`.trim();
    return name || fallback;
}

