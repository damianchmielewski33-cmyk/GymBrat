export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col justify-center px-4 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))] sm:py-16">
        {children}
      </div>
    </div>
  );
}
