export interface IAIGenBlogPostOptions {
    topic: string;
    keywords?: string[];
    tone?: string;
    audience?: string;
    length?: 'short' | 'medium' | 'long';
}

export interface GeminiConfig {
    model?: string;
    prompts?: {
        blogPost?: string;
        reviewReply?: string;
        emailCopy?: string;
    };
}

export interface AIUsageMetadata {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
}

export interface AIGenerationResult<T> {
    content: T;
    usage: AIUsageMetadata;
}

export class GeminiService {
    private apiKey: string;
    private config?: GeminiConfig;

    constructor(apiKey: string, config?: GeminiConfig) {
        if (!apiKey) throw new Error("GEMINI_API_KEY is required.");
        this.apiKey = apiKey;
        this.config = config;
    }

    /**
     * Generates a blog post using Gemini Pro.
     */
    async generateBlogPost(topicName: string, topicDesc: string, localeInfo: { studioName: string, city: string, businessType: string }): Promise<AIGenerationResult<{ title: string, content: string, imagePrompt: string }>> {
        const defaultBlogPostPrompt = `
            You are an expert SEO content writer for fitness and wellness studios.
            Write a high-quality, engaging blog post of about 400-600 words for a studio called "{{studioName}}" in {{city}}.
            The studio is a "{{businessType}}".
            The topic is "{{topicName}}": {{topicDesc}}

            Requirements:
            1. Include a catchy, SEO-optimized title.
            2. Use a friendly, professional tone.
            3. Naturally incorporate keywords related to the topic and the local area.
            4. Structure with clear headings (Markdown).
            5. The content should feel "local" and relevant to the community.
            6. Provide a "imagePrompt": a short, descriptive prompt (max 20 words) that describes a high-end, aesthetic photography scene representing this blog post topic for an AI image generator. Avoid text in the image.
            7. Output the result in JSON format with "title", "content", and "imagePrompt" fields.
        `;

        const systemPromptTemplate = this.config?.prompts?.blogPost || defaultBlogPostPrompt;

        const prompt = systemPromptTemplate
            .replace(/{{studioName}}/g, localeInfo.studioName)
            .replace(/{{city}}/g, localeInfo.city)
            .replace(/{{businessType}}/g, localeInfo.businessType)
            .replace(/{{topicName}}/g, topicName)
            .replace(/{{topicDesc}}/g, topicDesc);

        const model = this.config?.model || 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

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
            const usage = data.usageMetadata as AIUsageMetadata;

            // Extract JSON from potential markdown code blocks
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            let content;
            if (jsonMatch) {
                content = JSON.parse(jsonMatch[0]);
            } else {
                // Fallback if not pure JSON
                content = {
                    title: `${topicName} at ${localeInfo.studioName}`,
                    content: text,
                    imagePrompt: `A high-end, aesthetic photograph representing ${topicName} for ${localeInfo.studioName}.`
                };
            }

            return { content, usage };
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
    }): Promise<AIGenerationResult<string>> {
        const { reviewContent, rating, studioName, businessType = 'fitness studio', city = '' } = params;
        const locationHint = city ? ` in ${city}` : '';

        const defaultReviewReplyPrompt = `You are writing a brief, professional owner reply to a customer review for a business called "${studioName}"${locationHint}, a ${businessType}.

Review rating: ${rating} out of 5 stars.
Review text: ${reviewContent || '(no text provided)'}

Write a single short reply (2-4 sentences, under 350 characters) that:
1. Thanks the reviewer.
2. If the rating is 4-5: express gratitude and invite them back.
3. If the rating is 1-3: acknowledge their feedback and state that you take it seriously and would like to improve.
4. Sound warm and human, not corporate. Do not use hashtags or excessive punctuation.
5. Do not repeat the review content verbatim.
Output only the reply text, no quotes or labels.`;

        const systemPrompt = this.config?.prompts?.reviewReply || defaultReviewReplyPrompt;

        const model = this.config?.model || 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: systemPrompt }] }],
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
            const usage = data.usageMetadata as AIUsageMetadata;

            return {
                content: text.replace(/^["']|["']$/g, ''),
                usage
            };
        } catch (err) {
            console.error('Failed to generate review reply draft:', err);
            throw err;
        }
    }

    /**
     * Generates a beautifully formatted marketing email body in HTML based on a user prompt.
     */
    async generateEmailCopy(prompt: string, studioName?: string): Promise<AIGenerationResult<string>> {
        const defaultEmailCopyPrompt = `You are an expert, friendly copywriter for a local fitness/wellness studio${studioName ? ` called "${studioName}"` : ''}.
Write a warm, engaging, and professional email message based on the user's prompt.
Requirements:
1. Output ONLY beautifully formatted HTML that is ready to be injected into a rich text editor.
2. Use basic HTML tags like <p>, <strong>, <em>, <ul>, <li>, and <br>.
3. DO NOT wrap the output in a markdown code block (like \`\`\`html). Output the raw HTML elements directly.
4. Try to make it feel personalized and welcoming.
5. You may use the variables {{firstName}} and {{studioName}} if appropriate in the context of the email.
6. Keep it concise, usually 2-4 short paragraphs unless otherwise instructed.`;

        const systemPrompt = this.config?.prompts?.emailCopy || defaultEmailCopyPrompt;
        const model = this.config?.model || 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: `${systemPrompt}\n\nPrompt: ${prompt}` }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Gemini API error: ${response.status} - ${error}`);
            }

            const data = await response.json() as any;
            let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const usage = data.usageMetadata as AIUsageMetadata;

            // Strip potential markdown wrappers
            text = text.replace(/^```html\n?/, '').replace(/```$/, '').trim();

            return { content: text, usage };
        } catch (err) {
            console.error('Failed to generate email copy:', err);
            throw err;
        }
    }
}
