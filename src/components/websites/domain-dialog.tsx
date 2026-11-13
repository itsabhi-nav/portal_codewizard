"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";

const schema = z.object({
  domain: z.string().min(1, "Domain is required"),
  reason: z.string().optional(),
});

export function DomainDialog({
  open,
  onOpenChange,
  websiteId,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { domain: "", reason: "" },
  });

  useEffect(() => {
    if (open) reset({ domain: "", reason: "" });
  }, [open, reset]);

  async function onSubmit(values: z.infer<typeof schema>) {
    const response = await fetch(`/api/admin/websites/${websiteId}/domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: values.domain, isPrimary: true, reason: values.reason || undefined }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) {
      toast.error(json?.error?.message ?? "Failed to update domain");
      return;
    }
    toast.success("Domain updated");
    onOpenChange(false);
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Domain</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Domain" required error={errors.domain?.message} hint="e.g. example.com">
            <Input {...register("domain")} placeholder="example.com" />
          </Field>
          <Field label="Reason (optional)" error={errors.reason?.message}>
            <Input {...register("reason")} placeholder="Domain migration" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Domain
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
