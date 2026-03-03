import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

export const loader = async (args: any) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();

    // Authorization is already handled by admin._index.tsx layout, but we fetch the data we need.
    try {
        const configs = await apiRequest<any[]>("/admin/platform/config", token);
        const aiConfigItem = configs.find((c: any) => c.key === "config_ai");
        return { initialConfig: aiConfigItem?.value || {} };
    } catch (e: any) {
        return { initialConfig: {}, error: e.message };
    }
};

const DEFAULT_PROMPTS = {
    blogPost: `You are an expert SEO content writer for fitness and wellness studios.
Write a high-quality, engaging blog post of about 400-600 words for a studio called "{{studioName}}" in {{city}}.
The studio is a "{{businessType}}".
The topic is "{{topicName}}": {{topicDesc}}

Requirements:
1. Include a catchy, SEO-optimized title.
2. Structure the content logically with clear headings (H2, H3).
3. Use a tone appropriate for the studio type.
4. Naturally weave in keywords if provided.
5. Format the output in clean, semantic HTML (using <h1>, <h2>, <p>, <ul>, <li>, <strong>). DO NOT use <head>, <body>, or <html> tags.
6. In addition to the HTML content, provide a short prompt for generating a cover image.
7. Output the result in JSON format with "title", "content", and "imagePrompt" fields.`,
    reviewReply: `You are writing a brief, professional owner reply to a customer review for a business called "{{studioName}}" in {{city}}, a {{businessType}}.

Review rating: {{rating}} out of 5 stars.
Review text: {{reviewContent}}

Write a single short reply (2-4 sentences, under 350 characters) that:
1. Thanks the reviewer.
2. If the rating is 4-5: express gratitude and invite them back.
3. If the rating is 1-3: acknowledge their feedback and state that you take it seriously and would like to improve.
4. Sound warm and human, not corporate. Do not use hashtags or excessive punctuation.
5. Do not repeat the review content verbatim.
Output only the reply text, no quotes or labels.`,
    emailCopy: `You are an expert, friendly copywriter for a local fitness/wellness studio called "{{studioName}}".
Write a warm, engaging, and professional email message based on the user's prompt.
Requirements:
1. Output ONLY beautifully formatted HTML that is ready to be injected into a rich text editor.
2. Use basic HTML tags like <p>, <strong>, <em>, <ul>, <li>, and <br>.
3. DO NOT wrap the output in a markdown code block (like \`\`\`html). Output the raw HTML elements directly.
4. Try to make it feel personalized and welcoming.
5. You may use the variables {{firstName}} and {{studioName}} if appropriate in the context of the email.
6. Keep it concise, usually 2-4 short paragraphs unless otherwise instructed.`
};

export default function AdminAIConfiguration() {
    const { initialConfig, error } = useLoaderData<any>();
    const { getToken } = useAuth();

    const [isSaving, setIsSaving] = useState(false);
    const [model, setModel] = useState(initialConfig.model || "gemini-2.0-flash");

    const [blogPrompt, setBlogPrompt] = useState(initialConfig.prompts?.blogPost || "");
    const [reviewPrompt, setReviewPrompt] = useState(initialConfig.prompts?.reviewReply || "");
    const [emailPrompt, setEmailPrompt] = useState(initialConfig.prompts?.emailCopy || "");

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const token = await getToken();
            const payload = {
                enabled: true,
                description: "AI Configuration settings mapping models and prompts.",
                value: {
                    model: model.trim(),
                    prompts: {
                        blogPost: blogPrompt.trim() || undefined,
                        reviewReply: reviewPrompt.trim() || undefined,
                        emailCopy: emailPrompt.trim() || undefined,
                    }
                }
            };

            await apiRequest("/admin/platform/config/config_ai", token, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
            toast.success("AI Configuration saved successfully");
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Failed to save AI configuration");
        } finally {
            setIsSaving(false);
        }
    };

    if (error) {
        return <div className="p-8 text-red-600">Error loading AI config: {error}</div>;
    }

    return (
        <div className="max-w-4xl mx-auto py-8">
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI Configuration</h1>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2">Manage backend models and system prompts for all AI-powered studio features.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save AI Configurations"}
                </Button>
            </div>

            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Model Settings</CardTitle>
                        <CardDescription>
                            Define the API model alias used by the Google Generative Language endpoints.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Gemini API Model</Label>
                            <Input
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                placeholder="gemini-2.0-flash"
                            />
                            <p className="text-xs text-zinc-500">
                                This overrides the default <code>gemini-2.0-flash</code>. Ensure the model is available on the v1beta endpoint.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>System Prompts</CardTitle>
                        <CardDescription>
                            Override the default system prompts. Leave blank to use the system defaults.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label>Content Automation System Prompt (Blog Posts)</Label>
                                <Button variant="ghost" size="sm" onClick={() => setBlogPrompt(DEFAULT_PROMPTS.blogPost)} className="text-xs h-6 px-2">Restore Default</Button>
                            </div>
                            <Textarea
                                className="min-h-[160px] font-mono text-xs"
                                value={blogPrompt}
                                onChange={(e) => setBlogPrompt(e.target.value)}
                                placeholder="Leave blank to use the platform default prompt..."
                            />
                            <p className="text-xs text-zinc-500">
                                Variables: <code>{"{{studioName}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{businessType}}"}</code>, <code>{"{{topicName}}"}</code>, <code>{"{{topicDesc}}"}</code>
                            </p>
                        </div>

                        <div className="grid gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                            <div className="flex items-center justify-between">
                                <Label>Review Replies System Prompt</Label>
                                <Button variant="ghost" size="sm" onClick={() => setReviewPrompt(DEFAULT_PROMPTS.reviewReply)} className="text-xs h-6 px-2">Restore Default</Button>
                            </div>
                            <Textarea
                                className="min-h-[160px] font-mono text-xs"
                                value={reviewPrompt}
                                onChange={(e) => setReviewPrompt(e.target.value)}
                                placeholder="Leave blank to use the platform default prompt..."
                            />
                            <p className="text-xs text-zinc-500">
                                Variables: <code>{"{{studioName}}"}</code>, <code>{"{{city}}"}</code>, <code>{"{{businessType}}"}</code>, <code>{"{{rating}}"}</code>, <code>{"{{reviewContent}}"}</code>
                            </p>
                        </div>

                        <div className="grid gap-2 border-t border-zinc-200 dark:border-zinc-800 pt-6">
                            <div className="flex items-center justify-between">
                                <Label>Email & Campaign Copy Prompt</Label>
                                <Button variant="ghost" size="sm" onClick={() => setEmailPrompt(DEFAULT_PROMPTS.emailCopy)} className="text-xs h-6 px-2">Restore Default</Button>
                            </div>
                            <Textarea
                                className="min-h-[160px] font-mono text-xs"
                                value={emailPrompt}
                                onChange={(e) => setEmailPrompt(e.target.value)}
                                placeholder="Leave blank to use the platform default prompt..."
                            />
                            <p className="text-xs text-zinc-500">
                                Variables: <code>{"{{firstName}}"}</code>, <code>{"{{studioName}}"}</code>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
