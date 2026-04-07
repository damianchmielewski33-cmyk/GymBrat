export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-16">
        {children}
      </div>
    </div>
  );
}
