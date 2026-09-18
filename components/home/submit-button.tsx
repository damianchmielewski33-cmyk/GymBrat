"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="cta"
      disabled={pending}
      aria-busy={pending}
      className={cn("w-full", className)}
    >
      {pending ? "Zapisywanie…" : children}
    </Button>
  );
}
