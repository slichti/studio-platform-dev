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
}
