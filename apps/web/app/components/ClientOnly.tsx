import { useEffect, useState } from "react";

interface ClientOnlyProps {
    children: React.ReactNode | (() => React.ReactNode);
    fallback?: React.ReactNode;
}

/**
 * Ensures that the children are ONLY rendered on the client.
 * This is useful for components that rely on browser-only APIs or large libraries
 * that we want to exclude from the server-side (Edge Worker) bundle.
 */
export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return <>{fallback}</>;
    }

    return <>{typeof children === 'function' ? (children as () => React.ReactNode)() : children}</>;
}
