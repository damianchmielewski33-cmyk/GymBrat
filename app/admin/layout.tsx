import type { ReactNode } from "react";

export const runtime = "nodejs";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
    </div>
  );
}
