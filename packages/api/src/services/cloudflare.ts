
export class CloudflareService {
    private accountId: string;
    private apiToken: string;
    private projectName: string = 'studio-platform-web';

    constructor(accountId?: string, apiToken?: string) {
        this.accountId = accountId || '';
        this.apiToken = apiToken || '';
    }

    private get headers() {
        return {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
        };
    }

    private async request(path: string, options: RequestInit = {}) {
        if (!this.accountId || !this.apiToken) {
            throw new Error('Cloudflare Service: Missing Account ID or API Token');
        }

        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.projectName}${path}`;
        const response = await fetch(url, {
            ...options,
            headers: {
                ...this.headers,
                ...options.headers
            }
        });

        const data: any = await response.json();

        if (!response.ok) {
            if (response.status === 404 && options.method === 'GET') return null;

            const errorMsg = data.errors?.[0]?.message || data.message || `Cloudflare API error: ${response.status}`;
            console.error(`Cloudflare API Error (${options.method} ${path}):`, data);
            throw new Error(errorMsg);
        }

        return data.result;
    }

    async addDomain(domain: string) {
        return this.request('/domains', {
            method: 'POST',
            body: JSON.stringify({ name: domain })
        });
    }

    async getDomain(domain: string) {
        return this.request(`/domains/${domain}`);
    }

    async deleteDomain(domain: string) {
        await this.request(`/domains/${domain}`, {
            method: 'DELETE'
        });
        return true;
    }

    async listDomains() {
        return this.request('/domains');
    }
}
