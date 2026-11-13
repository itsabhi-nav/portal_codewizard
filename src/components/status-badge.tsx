import { Badge } from "@/components/ui/badge";

const VARIANTS: Record<string, "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "outline"> = {
  // Website status
  development: "info",
  testing: "warning",
  live: "success",
  suspended: "destructive",
  archived: "secondary",
  // AMC business status
  active: "success",
  upcoming: "info",
  expired: "warning",
  overdue: "destructive",
  exempt: "secondary",
  disabled: "outline",
  // Access status
  manual_suspended: "warning",
  // Payment status
  created: "info",
  pending: "warning",
  successful: "success",
  failed: "destructive",
  refunded: "secondary",
  partially_refunded: "warning",
  // Invoice status
  draft: "outline",
  sent: "info",
  paid: "success",
  partially_paid: "warning",
  cancelled: "secondary",
  // Refund status
  // (pending/successful/failed already mapped)
};

function labelize(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status }: { status: string }) {
  const variant = VARIANTS[status] ?? "outline";
  return <Badge variant={variant}>{labelize(status)}</Badge>;
}
