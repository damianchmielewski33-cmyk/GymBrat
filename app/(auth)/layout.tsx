import { Suspense } from "react";
import { Bebas_Neue } from "next/font/google";
import { connection } from "next/server";
import { SisterSiteArrivalBanner } from "@/components/sister-site-arrival-banner";
import { AuthShell } from "@/components/auth/auth-shell";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <div className={bebasNeue.variable}>
      <Suspense fallback={null}>
        <SisterSiteArrivalBanner />
      </Suspense>
      <AuthShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
          {children}
        </div>
      </AuthShell>
    </div>
  );
}
