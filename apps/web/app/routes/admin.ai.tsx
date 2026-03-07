import { useLoaderData, useNavigate } from "react-router";
import { getAuth } from "@clerk/react-router/server";
import { apiRequest } from "../utils/api";
import { useState } from "react";
import { useAuth } from "@clerk/react-router";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Activity, DollarSign, Zap, Clock, User, Building2 } from "lucide-react";
import { Badge } from "../components/ui/Badge";

export const loader = async (args: any) => {
    const { getToken, userId } = await getAuth(args);
    const token = await getToken();

    // Authorization is already handled by admin._index.tsx layout, but we fetch the data we need.
    try {
        const [configs, usage] = await Promise.all([
            apiRequest<any[]>("/admin/platform/config", token),
            apiRequest<any>("/admin/ai/usage", token)
        ]);
        const aiConfigItem = configs.find((c: any) => c.key === "config_ai");
        return { initialConfig: aiConfigItem?.value || {}, usage };
    } catch (e: any) {
        console.error("AI Loader Error:", e);
        return { initialConfig: {}, usage: null, error: e.message };
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

const AVAILABLE_MODELS = [
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Cheapest & Fastest)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Better reasoning)" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Latest generation)" },
    { value: "gemini-2.0-pro-exp-02-05", label: "Gemini 2.0 Pro Experimental" },
];

export default function AdminAIConfiguration() {
    const { initialConfig, usage, error } = useLoaderData<any>();
    const { getToken } = useAuth();

    const [isSaving, setIsSaving] = useState(false);
    const [model, setModel] = useState(initialConfig.model || "gemini-1.5-flash");
    const [modelOverrides, setModelOverrides] = useState(initialConfig.modelOverrides || {
        blogPost: "",
        reviewReply: "",
        emailCopy: "",
        communityPost: ""
    });

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
                    enabled: true,
                    model: model.trim(),
                    modelOverrides: {
                        blogPost: modelOverrides.blogPost || undefined,
                        reviewReply: modelOverrides.reviewReply || undefined,
                        emailCopy: modelOverrides.emailCopy || undefined,
                        communityPost: modelOverrides.communityPost || undefined,
                    },
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

            {usage && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <Card className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-zinc-900 border-indigo-100 dark:border-indigo-900/50">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-indigo-600" />
                                Est. Cost (30d)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                ${usage.summary?.totalCost?.toFixed(4) || "0.0000"}
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">Based on Gemini token pricing</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Zap className="w-4 h-4 text-amber-500" />
                                Total Tokens
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                {usage.summary?.totalTokens?.toLocaleString() || 0}
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">{usage.summary?.count || 0} total AI generations</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Activity className="w-4 h-4 text-emerald-500" />
                                Avg. Req Size
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                                {usage.summary?.count ? Math.round(usage.summary.totalTokens / usage.summary.count).toLocaleString() : 0}
                            </div>
                            <p className="text-xs text-zinc-500 mt-1">Tokens per request</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="space-y-8">
                {usage && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent AI Activity</CardTitle>
                            <CardDescription>The last 10 generations performed across the platform.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                            <th className="text-left py-3 font-medium text-zinc-500">Feature</th>
                                            <th className="text-left py-3 font-medium text-zinc-500">Studio</th>
                                            <th className="text-left py-3 font-medium text-zinc-500">Tokens</th>
                                            <th className="text-left py-3 font-medium text-zinc-500">Model</th>
                                            <th className="text-left py-3 font-medium text-zinc-500">Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {usage.recentLogs?.map((log: any) => (
                                            <tr key={log.id} className="group">
                                                <td className="py-3 capitalize flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                                                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-tight px-1.5 py-0">
                                                        {log.feature?.replace('_', ' ')}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 text-zinc-600 dark:text-zinc-400">
                                                    {log.tenantName || <span className="text-zinc-400 italic">System</span>}
                                                </td>
                                                <td className="py-3 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                                                    {log.totalTokens.toLocaleString()}
                                                </td>
                                                <td className="py-3 text-xs font-mono text-zinc-500">
                                                    {log.model}
                                                </td>
                                                <td className="py-3 text-zinc-500 flex items-center gap-1.5 whitespace-nowrap">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!usage.recentLogs || usage.recentLogs.length === 0) && (
                                            <tr>
                                                <td colSpan={5} className="py-8 text-center text-zinc-500 italic">
                                                    No AI activity recorded yet.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}



                {usage && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Usage by Tenant</CardTitle>
                            <CardDescription>Estimated cost and token consumption breakdown per studio (last 30 days).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-100 dark:border-zinc-800">
                                            <th className="text-left py-3 font-medium text-zinc-500">Tenant / Studio</th>
                                            <th className="text-right py-3 font-medium text-zinc-500">Generations</th>
                                            <th className="text-right py-3 font-medium text-zinc-500">Total Tokens</th>
                                            <th className="text-right py-3 font-medium text-zinc-500">Est. Spend</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {usage.byTenant?.map((tenant: any) => (
                                            <tr key={tenant.tenantId || 'system'} className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                                    {tenant.tenantName || <span className="text-zinc-400 italic">System / Platform</span>}
                                                </td>
                                                <td className="py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                                                    {tenant.count.toLocaleString()}
                                                </td>
                                                <td className="py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                                                    {tenant.totalTokens.toLocaleString()}
                                                </td>
                                                <td className="py-3 text-right tabular-nums font-semibold text-indigo-600 dark:text-indigo-400">
                                                    ${tenant.estimatedCost.toFixed(4)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!usage.byTenant || usage.byTenant.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="py-8 text-center text-zinc-500 italic">
                                                    No tenant activity recorded in this period.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {usage.byTenant?.length > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-zinc-100 dark:border-zinc-800 font-bold">
                                                <td className="py-4 text-zinc-900 dark:text-zinc-100">Total Platform Spend</td>
                                                <td className="py-4 text-right tabular-nums">
                                                    {usage.byTenant.reduce((acc: number, curr: any) => acc + curr.count, 0).toLocaleString()}
                                                </td>
                                                <td className="py-4 text-right tabular-nums">
                                                    {usage.byTenant.reduce((acc: number, curr: any) => acc + curr.totalTokens, 0).toLocaleString()}
                                                </td>
                                                <td className="py-4 text-right tabular-nums text-indigo-600 dark:text-indigo-400">
                                                    ${usage.summary?.totalCost?.toFixed(4) || "0.0000"}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Global Model Settings</CardTitle>
                        <CardDescription>
                            Default fallback model for all AI features.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-2">
                            <Label>Default Gemini Model</Label>
                            <Select
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                            >
                                {AVAILABLE_MODELS.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </Select>
                            <p className="text-xs text-zinc-500">
                                This acts as the fallback if no feature-specific model is defined below.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Feature Model Overrides</CardTitle>
                        <CardDescription>
                            Optimize cost and quality by assigning specific models to different tasks.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Blog Post Generation</Label>
                                <Select
                                    value={modelOverrides.blogPost}
                                    onChange={(e) => setModelOverrides({ ...modelOverrides, blogPost: e.target.value })}
                                >
                                    <option value="">Use Global Default</option>
                                    {AVAILABLE_MODELS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </Select>
                                <p className="text-[10px] text-zinc-500 italic">Recommended: Gemini 1.5 Pro</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Review Replies</Label>
                                <Select
                                    value={modelOverrides.reviewReply}
                                    onChange={(e) => setModelOverrides({ ...modelOverrides, reviewReply: e.target.value })}
                                >
                                    <option value="">Use Global Default</option>
                                    {AVAILABLE_MODELS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </Select>
                                <p className="text-[10px] text-zinc-500 italic">Recommended: Gemini 1.5 Flash</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Email & Campaign Copy</Label>
                                <Select
                                    value={modelOverrides.emailCopy}
                                    onChange={(e) => setModelOverrides({ ...modelOverrides, emailCopy: e.target.value })}
                                >
                                    <option value="">Use Global Default</option>
                                    {AVAILABLE_MODELS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </Select>
                                <p className="text-[10px] text-zinc-500 italic">Recommended: Gemini 1.5 Pro</p>
                            </div>

                            <div className="space-y-2">
                                <Label>Community AI Assist</Label>
                                <Select
                                    value={modelOverrides.communityPost}
                                    onChange={(e) => setModelOverrides({ ...modelOverrides, communityPost: e.target.value })}
                                >
                                    <option value="">Use Global Default</option>
                                    {AVAILABLE_MODELS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </Select>
                                <p className="text-[10px] text-zinc-500 italic">Recommended: Gemini 1.5 Flash</p>
                            </div>
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
