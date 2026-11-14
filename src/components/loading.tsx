import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ))}
    </div>
  );
}

export function AdminPageSkeleton() {
  return (
    <div
      className="space-y-5 sm:space-y-6"
      role="status"
      aria-label="Loading page"
      aria-busy="true"
    >
      <span className="sr-only">Loading page content…</span>
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <CardSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export function LoadErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive" className="my-3 flex items-center justify-between gap-4">
      <div>
        <AlertTitle>Could not load data</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </Alert>
  );
}
