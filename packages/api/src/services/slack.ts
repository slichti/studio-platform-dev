
export class SlackService {
    private webhookUrl?: string;
    private botToken?: string;

    constructor(config: { webhookUrl?: string, botToken?: string }) {
        this.webhookUrl = config.webhookUrl;
        this.botToken = config.botToken;
    }

    async sendNotification(message: string, channel?: string) {
        if (this.webhookUrl) {
            await this.sendViaWebhook(message);
        } else if (this.botToken && channel) {
            await this.sendViaBot(message, channel);
        } else {
            console.warn("SlackService: No Webhook URL or Bot Token/Channel provided.");
        }
    }

    private async sendViaWebhook(text: string) {
        if (!this.webhookUrl) return;
        try {
            await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
        } catch (e) {
            console.error("Slack Webhook failed", e);
        }
    }

    private async sendViaBot(text: string, channel: string) {
        if (!this.botToken) return;
        try {
            const response = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.botToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ channel, text })
            });
            const data: any = await response.json();
            if (!data.ok) {
                console.error("Slack Bot API failed", data.error);
            }
        } catch (e) {
            console.error("Slack Bot Request failed", e);
        }
    }
}
