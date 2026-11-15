import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CommunityHubTabs } from "@/components/community/community-hub-tabs";
import { GymMapView } from "@/components/gym-partner/gym-map-view";
import { getMyPresence, listIncoming } from "@/lib/gym-partner/presence";

export const metadata = { title: "Mapa siłowni" };

export default async function GymMapPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

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
