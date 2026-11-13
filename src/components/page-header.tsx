import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:items-center sm:justify-between sm:gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:mt-1 sm:text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
