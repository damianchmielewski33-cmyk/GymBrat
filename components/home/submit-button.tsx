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
      disabled={pending}
      aria-busy={pending}
      className={cn(className)}
    >
      {pending ? "Zapisywanie…" : children}
    </Button>
  );
}
