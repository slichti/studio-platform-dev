
import { EncryptionUtils } from '../utils/encryption';

export class ZoomService {
    private accountId: string;
    private clientId: string;
    private clientSecret: string;
    private db: D1Database;

    constructor(
        accountId: string,
        clientId: string,
        clientSecret: string,
        db: D1Database
    ) {
        this.accountId = accountId;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.db = db;
    }

    private async getAccessToken(): Promise<string> {
        // In a real implementation we should cache this token in DB or KV
        const tokenUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${this.accountId}`;
        const auth = btoa(`${this.clientId}:${this.clientSecret}`);

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get Zoom access token: ${error}`);
        }

        const data: any = await response.json();
        return data.access_token;
    }

    async createMeeting(topic: string, startTime: Date, durationMinutes: number) {
        const token = await this.getAccessToken();

        const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic,
                type: 2, // Scheduled meeting
                start_time: startTime.toISOString().split('.')[0] + 'Z', // Zoom expects ISO8601
                duration: durationMinutes,
                timezone: 'UTC', // We store everything in UTC
                settings: {
                    host_video: true,
                    participant_video: true,
                    join_before_host: true,
                    mute_upon_entry: true,
                    waiting_room: false,
                    auto_recording: 'none' // or 'cloud'
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create Zoom meeting: ${error}`);
        }

        return await response.json();
    }

    async deleteMeeting(meetingId: string) {
        if (!meetingId) return;
        const token = await this.getAccessToken();

        await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    }

    async updateMeeting(meetingId: string, topic: string, startTime: Date, durationMinutes: number) {
        if (!meetingId) return;
        const token = await this.getAccessToken();

        await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                topic,
                start_time: startTime.toISOString().split('.')[0] + 'Z',
                duration: durationMinutes
            })
        });
    }

    // Helper to get Zoom Service instance for a tenant
    static async getForTenant(tenant: any, env: any, encryption: EncryptionUtils): Promise<ZoomService | null> {
        if (!tenant.zoomCredentials) return null;

        try {
            const creds = tenant.zoomCredentials as any;
            if (!creds.accountId || !creds.clientId || !creds.clientSecret) return null;

            const decryptedSecret = await encryption.decrypt(creds.clientSecret);

            return new ZoomService(
                creds.accountId,
                creds.clientId,
                decryptedSecret,
                env.DB // Pass D1 for caching if we implemented it
            );
        } catch (e) {
            console.error("Failed to initialize Zoom Service", e);
            return null;
        }
    }
}
