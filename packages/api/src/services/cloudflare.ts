
export class CloudflareService {
    private accountId: string;
    private apiToken: string;
    private projectName: string = 'studio-platform-web'; // Hardcoded for now, could be env var

    constructor(accountId: string, apiToken: string) {
        this.accountId = accountId;
        this.apiToken = apiToken;
    }

    async addDomain(domain: string) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.projectName}/domains`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: domain
                })
            });

            const data: any = await response.json();

            if (!response.ok) {
                console.error('Cloudflare API Error (Add Domain):', data);
                throw new Error(data.errors?.[0]?.message || 'Failed to add domain to Cloudflare');
            }

            return data.result;
        } catch (error) {
            console.error('Cloudflare Add Domain Exception:', error);
            throw error;
        }
    }

    async getDomain(domain: string) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.projectName}/domains/${domain}`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data: any = await response.json();

            if (!response.ok) {
                // 404 is fine, means not found
                if (response.status === 404) return null;
                console.error('Cloudflare API Error (Get Domain):', data);
                throw new Error(data.errors?.[0]?.message || 'Failed to get domain status');
            }

            return data.result;
        } catch (error) {
            console.error('Cloudflare Get Domain Exception:', error);
            throw error;
        }
    }

    async deleteDomain(domain: string) {
        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.projectName}/domains/${domain}`;

        try {
            const response = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data: any = await response.json();

            if (!response.ok) {
                console.error('Cloudflare API Error (Delete Domain):', data);
                throw new Error(data.errors?.[0]?.message || 'Failed to delete domain');
            }

            return true;
        } catch (error) {
            console.error('Cloudflare Delete Domain Exception:', error);
            throw error;
        }
    }
}
