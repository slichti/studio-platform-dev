import { EncryptionUtils } from '../utils/encryption';

interface MailchimpConfig {
    apiKey: string;
    serverPrefix: string;
    listId: string;
}

export class MailchimpService {
    private config: MailchimpConfig;

    constructor(config: MailchimpConfig) {
        this.config = config;
    }

    /**
     * Decrypts credentials and initializes the service.
     */
    static async getForTenant(tenant: any, env: any, encryption: EncryptionUtils): Promise<MailchimpService | null> {
        if (!tenant.mailchimpCredentials) return null;

        try {
            const apiKey = await encryption.decrypt(tenant.mailchimpCredentials.apiKey);
            return new MailchimpService({
                apiKey: apiKey,
                serverPrefix: tenant.mailchimpCredentials.serverPrefix,
                listId: tenant.mailchimpCredentials.listId
            });
        } catch (e) {
            console.error("Failed to decrypt Mailchimp credentials", e);
            return null;
        }
    }

    async addContact(email: string, mergeFields: Record<string, any> = {}, tags: string[] = []): Promise<boolean> {
        const { apiKey, serverPrefix, listId } = this.config;
        const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members`;

        // Mailchimp uses MD5 hash of lowercase email for subscriber ID
        // But for "add or update", we can try PUT to the specific member hash endpoint
        // Or POST to /members to create. POST fails if exists.
        // PUT /lists/{list_id}/members/{subscriber_hash} creates or updates.

        // Simple hash function (Web Crypto API available in Workers)
        const msgUint8 = new TextEncoder().encode(email.toLowerCase());
        const hashBuffer = await crypto.subtle.digest('MD5', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const subscriberHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        const memberUrl = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`;

        const body = {
            email_address: email,
            status_if_new: 'subscribed',
            status: 'subscribed', // Ensure they are subscribed
            merge_fields: mergeFields,
            tags // This adds tags. Note: Mailchimp API structure for tags on Create/Update via PUT might be strict.
        };

        const response = await fetch(memberUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Basic ${btoa(`anystring:${apiKey}`)}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.text();
            console.error("Mailchimp Sync Error:", err);
            return false;
        }

        // Handle Tags separately if needed (PUT member supports tags in some versions but mostly separate endpoint)
        // Actually, main Member endpoint handles 'tags' on creation but not update? 
        // Let's create a separate call for tags to be safe.
        if (tags.length > 0) {
            await this.addTags(subscriberHash, tags);
        }

        return true;
    }

    async addTags(subscriberHash: string, tags: string[]) {
        const { apiKey, serverPrefix, listId } = this.config;
        const url = `https://${serverPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}/tags`;

        const body = {
            tags: tags.map(t => ({ name: t, status: 'active' }))
        };

        await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(`anystring:${apiKey}`)}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    }
}
