import { AuthShell } from "@/components/auth/auth-shell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center">
        {children}
      </div>
    </AuthShell>
  );
}
