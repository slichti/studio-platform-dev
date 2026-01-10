
import { EncryptionUtils } from '../utils/encryption';

export class FlodeskService {
    private apiKey: string;
    private baseUrl = 'https://api.flodesk.com/v1';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    static async getForTenant(tenant: any, env: any, encryption: EncryptionUtils): Promise<FlodeskService | null> {
        if (tenant.marketingProvider !== 'flodesk') return null;
        if (!tenant.flodeskCredentials?.apiKey) return null;

        try {
            const apiKey = await encryption.decrypt(tenant.flodeskCredentials.apiKey);
            return new FlodeskService(apiKey);
        } catch (e) {
            console.error("Failed to decrypt Flodesk credentials", e);
            return null;
        }
    }

    /**
     * Add or Update Subscriber
     * Flodesk API: POST /subscribers
     */
    async addContact(email: string, fields: { firstName?: string, lastName?: string }, segments: string[] = []) {
        try {
            // 1. Create/Update Subscriber
            const body: any = {
                email,
                first_name: fields.firstName,
                last_name: fields.lastName,
            };

            // Flodesk doesn't support "tags" directly like Mailchimp on create, 
            // but we can add them to segments (which are roughly equivalent).
            // However, typical flow is Create -> Add to Segment.

            const response = await fetch(`${this.baseUrl}/subscribers`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${btoa(this.apiKey + ':')}`, // Basic Auth with API Key as username
                    'Content-Type': 'application/json',
                    'User-Agent': 'StudioPlatform/1.0'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Flodesk API Error: ${(err as any).message || response.statusText}`);
            }

            const subscriber: any = await response.json();

            // 2. Add to Segments (if any)
            if (segments.length > 0) {
                // Note: Flodesk requires Segment IDs, not names. 
                // For now, we might skipping looking up segment IDs by name to keep it simple,
                // or we assume 'segments' passed are IDs. 
                // Given the implementation plan, let's just log this limitation or try to create them?
                // Flodesk API doesn't allow creating segments on the fly easily via this endpoint.
                // We will skip segment tagging for MVP unless we look up segments.
                console.log("Segment tagging for Flodesk requires Segment IDs. Skipping for now.");
            }

            return subscriber;
        } catch (error) {
            console.error('Flodesk Add Contact Error:', error);
            throw error;
        }
    }
}
