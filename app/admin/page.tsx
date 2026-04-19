import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AdminPinForm } from "@/components/admin/admin-pin-form";
import {
  isAdminEligible,
  readAdminUnlockVerified,
} from "@/lib/admin-session";

export default async function AdminGatePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const eligible = await isAdminEligible(session);
  if (!eligible) {
    return (
      <div className="glass-panel neon-glow p-8 text-center">
        <h1 className="font-heading text-xl text-white">Brak dostępu</h1>
        <p className="mt-2 text-sm text-white/60">
          Dostęp mają wyłącznie konto pierwszego użytkownika zarejestrowanego w systemie.
        </p>
      </div>
    );
  }

  if (await readAdminUnlockVerified(session)) {
    redirect("/admin/overview");
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="glass-panel neon-glow px-8 py-10">
        <h1 className="font-heading text-center text-2xl font-semibold text-white">
          Panel administratora
        </h1>
        <p className="mt-2 text-center text-sm text-white/55">
          Wpisz PIN, aby zarządzać kontami i analityką GymBrat.
        </p>
        <AdminPinForm />
      </div>
    </div>
  );
}
