import type { ReactNode } from "react";

export const runtime = "nodejs";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full max-w-[100vw] overflow-x-clip">
      <div className="mx-auto w-full min-w-0 max-w-7xl px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4 sm:py-6 lg:px-6 lg:py-8">
        {children}
      </div>
    </div>
  );
}
