"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InlineBanner } from "@/components/ui/inline-banner";

/** Komunikat gdy trening trafił do kolejki offline (IndexedDB). */
export function QueuedWorkoutBanner() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = searchParams.get("queued") === "1";
    const s = sessionStorage.getItem("gymbrat:workoutQueued") === "1";
    if (q || s) {
      setOpen(true);
      sessionStorage.removeItem("gymbrat:workoutQueued");
    }
  }, [searchParams]);

  if (!open) return null;

  return (
    <InlineBanner variant="warning" className="mb-6" role="status">
      Ostatni trening został <strong className="text-amber-100">zapisany w kolejce</strong> (brak
      sieci). Wysyłka do serwera nastąpi automatycznie po odzyskaniu połączenia — możesz też
      odświeżyć stronę, gdy internet wróci.
    </InlineBanner>
  );
}
