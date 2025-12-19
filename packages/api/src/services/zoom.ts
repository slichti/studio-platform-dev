type ZoomTokenResponse = {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
};

type ZoomMeetingResponse = {
    id: number;
    join_url: string;
    start_url: string;
    password?: string;
};

export class ZoomService {
    private accountId: string;
    private clientId: string;
    private clientSecret: string;

    constructor(accountId: string, clientId: string, clientSecret: string) {
        this.accountId = accountId;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public async getAccessToken(): Promise<string> {
        const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
        const params = new URLSearchParams({
            grant_type: 'account_credentials',
            account_id: this.accountId,
        });

        const response = await fetch(`https://zoom.us/oauth/token?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get Zoom access token: ${error}`);
        }

        const data = await response.json() as ZoomTokenResponse;
        return data.access_token;
    }

    async createMeeting(userId: string, topic: string, startTime: Date, durationMinutes: number): Promise<string> {
        const token = await this.getAccessToken();

        // 1. Get Zoom User ID (or use 'me' if S2S app is authorized for all)
        // For S2S, 'me' refers to the account owner/admin context usually, but to create for a specific user
        // we might need their specific email. For now, let's create under the main account 'me'.
        // In real app, we'd map our DB userId -> Zoom userId via another lookup.
        const userIdForZoom = 'me';

        const body = {
            topic: topic,
            type: 2, // Scheduled Meeting
            start_time: startTime.toISOString(), // 2024-02-28T10:00:00Z
            duration: durationMinutes,
            // timezone: 'UTC', // Zoom defaults to account timezone or UTC
            settings: {
                host_video: true,
                participant_video: true,
                join_before_host: false,
                mute_upon_entry: true,
                auto_recording: 'cloud' // For our future recording requirement!
            }
        };

        const response = await fetch(`https://api.zoom.us/v2/users/${userIdForZoom}/meetings`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create Zoom meeting: ${error}`);
        }

        const data = await response.json() as ZoomMeetingResponse;
        return data.join_url;
    }
}
