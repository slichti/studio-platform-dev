export class StreamService {
    private accountId: string;
    private apiToken: string;

    constructor(accountId: string, apiToken: string) {
        this.accountId = accountId;
        this.apiToken = apiToken;
    }

    /**
     * Upload a video via a public or signed URL (e.g. Zoom download URL).
     * Cloudflare Stream will pull the file asynchronously.
     */
    async uploadViaLink(url: string, meta: { name: string }): Promise<string> {
        // Prepare the payload
        // See: https://developers.cloudflare.com/stream/uploading-videos/upload-via-link/
        const body = {
            url: url,
            meta: {
                name: meta.name
            },
            // requireSignedURLs: true // Optional: enforce signed URLs for playback
        };

        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/copy`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to initiate Stream upload: ${error}`);
        }

        const data = await response.json() as any;
        // The 'copy' endpoint returns the video object immediately with a status
        return data.result.uid; // The video ID
    }

    /**
     * Get video details to check status (ready vs processing).
     */
    async getVideoDetails(videoId: string) {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream/${videoId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to get video details');
        }

        const data = await response.json() as any;
        return data.result;
    }
}
