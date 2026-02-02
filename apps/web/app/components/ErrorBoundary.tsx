import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/Card";

interface ComponentErrorBoundaryProps {
    children: React.ReactNode;
    onReset?: () => void;
}

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
    return (
        <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    Error
                </CardTitle>
                <CardDescription className="text-red-600/90 dark:text-red-400/90">
                    Something went wrong while loading this component.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm font-mono text-red-600 dark:text-red-300 bg-red-100/50 dark:bg-red-950/30 p-2 rounded">
                    {(error as Error).message || "Unknown error occurred"}
                </p>
                <Button
                    onClick={resetErrorBoundary}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-700 hover:bg-red-100 hover:text-red-900 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/50"
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Try Again
                </Button>
            </CardContent>
        </Card>
    );
}

export function ComponentErrorBoundary({ children, onReset }: ComponentErrorBoundaryProps) {
    const { reset } = useQueryErrorResetBoundary();

    return (
        <ReactErrorBoundary
            onReset={() => {
                reset(); // Reset TanStack Query errors
                onReset?.(); // Run custom reset logic if provided
            }}
            FallbackComponent={ErrorFallback}
        >
            {children}
        </ReactErrorBoundary>
    );
}
