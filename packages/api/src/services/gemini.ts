export class GeminiService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Generates a blog post using Gemini Pro.
     */
    async generateBlogPost(topicName: string, topicDesc: string, localeInfo: { studioName: string, city: string, businessType: string }): Promise<{ title: string, content: string }> {
        const prompt = `
            You are an expert SEO content writer for fitness and wellness studios.
            Write a high-quality, engaging blog post of about 400-600 words for a studio called "${localeInfo.studioName}" in ${localeInfo.city}.
            The studio is a "${localeInfo.businessType}".
            The topic is "${topicName}": ${topicDesc}

            Requirements:
            1. Include a catchy, SEO-optimized title.
            2. Use a friendly, professional tone.
            3. Naturally incorporate keywords related to the topic and the local area.
            4. Structure with clear headings (Markdown).
            5. The content should feel "local" and relevant to the community.
            6. Provide a "imagePrompt": a short, descriptive prompt (max 20 words) that describes a high-end, aesthetic photography scene representing this blog post topic for an AI image generator. Avoid text in the image.
            7. Output the result in JSON format with "title", "content", and "imagePrompt" fields.
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 2048,
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Gemini API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as any;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Extract JSON from potential markdown code blocks
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            // Fallback if not pure JSON
            return {
                title: `${topicName} at ${localeInfo.studioName}`,
                content: text
            };
        } catch (err) {
            console.error('Failed to generate blog post:', err);
            throw err;
        }
    }

    /**
     * Generates a short, professional draft reply to a Google-style review for a fitness/wellness business.
     * Suitable for studio owners to copy into Google Business Profile or other review platforms.
     */
    async generateReviewReplyDraft(params: {
        reviewContent: string | null;
        rating: number;
        studioName: string;
        businessType?: string;
        city?: string;
    }): Promise<string> {
        const { reviewContent, rating, studioName, businessType = 'fitness studio', city = '' } = params;
        const locationHint = city ? ` in ${city}` : '';
        const prompt = `You are writing a brief, professional owner reply to a customer review for a business called "${studioName}"${locationHint}, a ${businessType}.

Review rating: ${rating} out of 5 stars.
Review text: ${reviewContent || '(no text provided)'}

Write a single short reply (2-4 sentences, under 350 characters) that:
1. Thanks the reviewer.
2. If the rating is 4-5: express gratitude and invite them back.
3. If the rating is 1-3: acknowledge their feedback and state that you take it seriously and would like to improve.
4. Sound warm and human, not corporate. Do not use hashtags or excessive punctuation.
5. Do not repeat the review content verbatim.
Output only the reply text, no quotes or labels.`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.5,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 256,
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Gemini API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as any;
            const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
            return text.replace(/^["']|["']$/g, '');
        } catch (err) {
            console.error('Failed to generate review reply draft:', err);
            throw err;
        }
    }
}
