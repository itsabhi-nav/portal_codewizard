import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  accent = "blue",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { label: string; positive?: boolean };
  accent?: "blue" | "cyan" | "violet" | "emerald" | "amber" | "rose";
}) {
  const accents: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-500/5 text-blue-500",
    cyan: "from-cyan-500/20 to-cyan-500/5 text-cyan-500",
    violet: "from-violet-500/20 to-violet-500/5 text-violet-500",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-500",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-500",
  };

  return (
    <Card className="relative overflow-hidden border-border/60">
      <CardContent className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground sm:text-xs sm:tracking-wider">
              {title}
            </p>
            <p className="mt-1 truncate text-base font-semibold tracking-tight sm:text-2xl">{value}</p>
            {subtitle && (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-muted-foreground sm:mt-1 sm:text-xs">
                {subtitle}
              </p>
            )}
            {trend && (
              <p className={cn("mt-1.5 text-[10px] font-medium sm:mt-2 sm:text-xs", trend.positive ? "text-emerald-500" : "text-rose-500")}>
                {trend.label}
              </p>
            )}
          </div>
          {icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br sm:h-11 sm:w-11 sm:rounded-xl",
                accents[accent]
              )}
            >
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
