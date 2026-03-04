import { useLoaderData } from "react-router";
import ReactMarkdown from "react-markdown";
import changelogContent from "../../../../docs/CHANGELOG.md?raw";

export const loader = async () => {
    return { content: changelogContent };
};

export default function DocumentationChangelog() {
    const { content } = useLoaderData<any>();

    return (
        <div className="prose prose-zinc dark:prose-invert max-w-none prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-zinc-600 dark:prose-p:text-zinc-400">
            <ReactMarkdown>{content}</ReactMarkdown>
        </div>
    );
}
