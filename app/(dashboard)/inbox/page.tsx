import { MessageCircle } from "lucide-react";

export default function InboxPage() {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Wiadomości
        </p>
        <h1 className="text-3xl font-semibold text-white">Skrzynka</h1>
      </header>

      <div className="app-card flex flex-col items-center gap-3 px-5 py-10 text-center">
        <MessageCircle className="h-8 w-8 text-[var(--gym-gold)]" />
        <p className="text-sm text-white/70">
          GymBrat nie oferuje czatu AI dla zawodników. Skrzynka będzie dostępna,
          gdy coach włączy wiadomości albo korektę techniki.
        </p>
      </div>
    </div>
  );
}
