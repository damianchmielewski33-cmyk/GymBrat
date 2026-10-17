import { AuthPageFrame } from "@/components/auth/auth-page-frame";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthPageFrame>{children}</AuthPageFrame>;
}
