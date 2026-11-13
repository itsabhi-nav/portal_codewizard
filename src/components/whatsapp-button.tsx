"use client";

import { useState } from "react";
import { MessageCircle, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/lib/whatsapp";

/**
 * WhatsApp click-to-chat button with an optional pre-filled message.
 * If no valid number is available, a warning is shown instead of a broken link.
 */
export function WhatsAppButton({
  number,
  message,
  label = "WhatsApp",
  variant = "outline",
  size = "sm",
  showCopy = true,
}: {
  number: string | null | undefined;
  message: string;
  label?: string;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "sm" | "default" | "icon";
  showCopy?: boolean;
  defaultCountryCode?: string;
}) {
  const [copied, setCopied] = useState(false);
  const link = buildWhatsAppLink(number, message, "https://wa.me/");

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Message copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy message");
    }
  }

  if (!link) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3.5 w-3.5" />
        No WhatsApp number
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <a href={link} target="_blank" rel="noopener noreferrer" title={label || "Open WhatsApp"}>
        <Button variant={variant} size={size} type="button">
          <MessageCircle className="h-4 w-4" />
          {label}
        </Button>
      </a>
      {showCopy && (
        <Button variant="ghost" size="icon" onClick={copyMessage} type="button" title="Copy message" className="h-8 w-8">
          {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      )}
    </span>
  );
}
