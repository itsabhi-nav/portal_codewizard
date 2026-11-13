"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Friendly admin error boundary. When Supabase is not configured, data pages
 * show this instead of a raw 500 page so the UI can still be explored.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] page error", error);
  }, [error]);

  const message = error?.message || "Unknown error";
  const isDatabase =
    message.includes("Supabase") ||
    message.includes("database") ||
    message.toLowerCase().includes("not configured");

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-lg border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {isDatabase ? (
              <Database className="h-5 w-5 text-amber-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            )}
            {isDatabase ? "Database not configured" : "Something went wrong"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isDatabase
              ? "The app is running, but data pages need Supabase. Add your Supabase credentials to .env.local and restart to load real data. You can still explore the navigation and layout."
              : message}
          </p>
          <Button onClick={() => reset()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
