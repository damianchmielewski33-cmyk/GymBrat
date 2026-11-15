import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CommunityHubTabs } from "@/components/community/community-hub-tabs";
import { GymMapView } from "@/components/gym-partner/gym-map-view";
import Link from "next/link";
import { isPremiumActive } from "@/lib/user-package";
import { getMyPresence, listIncoming } from "@/lib/gym-partner/presence";

export const metadata = { title: "Mapa siłowni" };

export default async function GymMapPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  if (!(await isPremiumActive(userId))) {
    return (
      <div className="space-y-5">
        <header>
          <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
          <h1 className="text-[length:var(--text-title-lg)] mt-1.5 font-heading font-semibold text-white">
            Mapa siłowni i partnerzy
          </h1>
        </header>
        <CommunityHubTabs />
        <div className="space-y-3 rounded-2xl border border-[var(--gym-gold)]/30 bg-black/30 p-5">
          <p className="text-[15px] font-semibold text-white">Funkcja Premium</p>
          <p className="text-[13px] text-white/65">
            Mapa siłowni z godzinami otwarcia i linkami, wyszukiwarka marek (np. Zdrofit) oraz
            szukanie partnera do treningu w pobliżu są dostępne w pakiecie Premium.
          </p>
          <Link
            href="/package"
            className="inline-flex min-h-11 items-center rounded-xl border border-[var(--gym-gold)]/40 bg-[var(--gym-gold)]/15 px-4 text-[13px] font-semibold text-[var(--gym-gold)]"
          >
            Zobacz pakiet Premium
          </Link>
        </div>
      </div>
    );
  }

  const [presence, incoming] = await Promise.all([
    getMyPresence(userId),
    listIncoming(userId),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <p className="app-label text-[var(--gym-gold)]">Społeczność</p>
        <h1 className="text-[length:var(--text-title-lg)] mt-1.5 font-heading font-semibold text-white">
          Mapa siłowni i partnerzy
        </h1>
        <p className="mt-2 text-[13px] text-white/50">
          Siłownie w okolicy i osoby, które szukają partnera do treningu.
        </p>
      </header>
      <CommunityHubTabs />
      <GymMapView
        mapsKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
        placesConfigured={Boolean(process.env.GOOGLE_PLACES_API_KEY)}
        initialPresence={presence}
        initialIncoming={incoming}
      />
    </div>
  );
}
