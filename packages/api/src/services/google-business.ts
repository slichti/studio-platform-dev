
export class GoogleBusinessProfileService {
    private clientId: string;
    private client_secret: string;
    private redirectUri: string;

    constructor(clientId: string, client_secret: string, redirectUri: string) {
        this.clientId = clientId;
        this.client_secret = client_secret;
        this.redirectUri = redirectUri;
    }

    getAuthUrl(state: string) {
        const scopes = [
            'https://www.googleapis.com/auth/business.manage'
        ];

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: scopes.join(' '),
            access_type: 'offline',
            prompt: 'consent',
            state: state
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async exchangeCode(code: string) {
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: this.clientId,
                client_secret: this.client_secret,
                redirect_uri: this.redirectUri,
                grant_type: 'authorization_code'
            })
        });

        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.error || 'Failed to exchange code');
        return data;
    }

    async refreshAccessToken(refreshToken: string) {
        if (!refreshToken) throw new Error("No refresh token provided");

        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.client_secret,
                grant_type: 'refresh_token',
                refresh_token: refreshToken
            })
        });

        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.error || 'Failed to refresh token');

        return {
            access_token: data.access_token,
            expiry_date: Date.now() + (data.expires_in * 1000)
        };
    }

    async updateLocation(accessToken: string, locationId: string, locationData: any) {
        // locationId format: "locations/{locationId}"
        const res = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?updateMask=name,storefrontAddress,regularHours`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(locationData)
        });

        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to update GBP location');
        return data;
    }

    async listLocations(accessToken: string, accountId: string) {
        // accountId format: "accounts/{accountId}"
        const res = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to list GBP locations');
        return data.locations || [];
    }

    async listAccounts(accessToken: string) {
        const res = await fetch(`https://mybusinessaccountmanagement.googleapis.com/v1/accounts`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to list GBP accounts');
        return data.accounts || [];
    }
}
