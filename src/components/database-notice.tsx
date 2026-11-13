import { Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Friendly placeholder shown when Supabase is not configured. It keeps the
 * admin shell visible so the UI can still be explored without a database.
 */
export function DatabaseNotice({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5 text-amber-500" />
            Database not configured
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {description ??
              "The app is running, but this page needs Supabase to load data. Add your Supabase credentials to .env.local and restart to see real data."}
          </p>
          <p className="text-sm font-medium">{title} preview unavailable.</p>
        </CardContent>
      </Card>
    </div>
  );
}
