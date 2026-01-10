
export class GoogleCalendarService {
    private clientId: string;
    private clientSecret: string;
    private redirectUri: string;

    constructor(clientId: string, clientSecret: string, redirectUri: string) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.redirectUri = redirectUri;
    }

    getAuthUrl(state: string) {
        const scopes = [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
        ];

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: scopes.join(' '),
            access_type: 'offline', // Request refresh token
            prompt: 'consent', // Force consent screen to ensure refresh token
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
                client_secret: this.clientSecret,
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
                client_secret: this.clientSecret,
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

    async createEvent(accessToken: string, calendarId: string = 'primary', event: any) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to create event');
        return data;
    }

    async updateEvent(accessToken: string, calendarId: string = 'primary', eventId: string, event: any) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
            method: 'PUT', // Use PUT to replace fully or PATCH to update partial. PUT is safer for ensuring state.
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to update event');
        return data;
    }

    async deleteEvent(accessToken: string, calendarId: string = 'primary', eventId: string) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!res.ok && res.status !== 410 && res.status !== 404) { // Ignore if already deleted
            const text = await res.text();
            throw new Error('Failed to delete event: ' + text);
        }
        return true;
    }

    // List calendars to let user pick one?
    async listCalendars(accessToken: string) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        const data: any = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to list calendars');
        return data.items || [];
    }
}
