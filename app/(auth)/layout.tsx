import { Bebas_Neue } from "next/font/google";
import { AuthShell } from "@/components/auth/auth-shell";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={bebasNeue.variable}>
      <AuthShell>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
          {children}
        </div>
      </AuthShell>
    </div>
  );
}
