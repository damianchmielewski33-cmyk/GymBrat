import { MessageCircle } from "lucide-react";
import { CoachChatPanel } from "@/components/coach/coach-chat-panel";
import { getCoachChatUiStatus } from "@/actions/coach-chat";

export default async function InboxPage() {
  const status = await getCoachChatUiStatus();

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Wiadomości
        </p>
        <h1 className="text-3xl font-semibold text-white">Skrzynka</h1>
        <p className="text-sm text-white/55">
        </p>
      </header>

      {status.mode === "hidden" ? (
        <div className="app-card flex flex-col items-center gap-3 px-5 py-10 text-center">
          <MessageCircle className="h-8 w-8 text-[var(--gym-gold)]" />
          <p className="text-sm text-white/70">
            Skrzynka będzie dostępna, gdy coach włączy czat albo korektę techniki.
          </p>
        </div>
      ) : (
        <div className="app-card overflow-hidden p-0">
          <CoachChatPanel mode={status.mode === "web" ? "web" : "ai"} />
        </div>
      )}
    </div>
  );
}
