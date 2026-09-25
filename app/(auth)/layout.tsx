import { AuthPageFrame } from "@/components/auth/auth-page-frame";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPageFrame>{children}</AuthPageFrame>;
}
