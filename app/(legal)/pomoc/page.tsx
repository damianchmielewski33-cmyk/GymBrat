import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { ensureCriticalSchema } from "@/db/ensure-schema";
import { LegalDocShell, LegalSection } from "@/components/legal/legal-doc-shell";
import { SupportForm } from "@/components/support/support-form";
import { LEGAL_DOCS_UPDATED_LABEL } from "@/lib/legal-versions";
import { DELETE_ACCOUNT_PATH, getLegalSeller, REGULAMIN_PATH } from "@/lib/legal-seller";
import { listUserOrders } from "@/lib/orders";
import { formatOrderDate, formatPln, orderStatusLabel } from "@/lib/orders-format";
import {
  SUPPORT_KIND_LABELS,
  SUPPORT_RESPONSE_DAYS,
  SUPPORT_STATUS_LABELS,
  isSupportStatus,
  supportDueLabel,
  type SupportKind,
} from "@/lib/support";
import { listUserSupportRequests } from "@/lib/support-requests";

export const metadata: Metadata = {
  title: "Pomoc i reklamacje",
  description: "Kontakt z obsługą GymBrat, najczęstsze pytania i formularz zgłoszeń oraz reklamacji.",
  robots: { index: true, follow: true },
};

const link = "text-[var(--gym-gold)] underline-offset-2 hover:underline";

export default async function PomocPage() {
  const s = getLegalSeller();
  const session = await auth();
  const userId = session?.user?.id;

  let orders: { id: string; label: string }[] = [];
  let mine: Awaited<ReturnType<typeof listUserSupportRequests>> = [];
  if (userId) {
    try {
      await ensureCriticalSchema();
      const list = await listUserOrders(userId, 20);
      orders = list.map((o) => ({
        id: o.id,
        label: `${formatOrderDate(o.paidAt ?? o.createdAt)} · ${formatPln(o.amountGrosze)} · ${orderStatusLabel(o.status)}`,
      }));
      mine = await listUserSupportRequests(getDb(), userId, 10);
    } catch {
      // Lista pomocnicza — formularz działa także bez niej.
    }
  }

  return (
    <LegalDocShell title="Pomoc i reklamacje" updated={LEGAL_DOCS_UPDATED_LABEL} incomplete={!s.complete}>
      <LegalSection id="kontakt" title="1. Kontakt">
        <p>
          E-mail:{" "}
          <a href={`mailto:${s.email}`} className={link}>
            {s.email}
          </a>
          {s.phone ? <> · telefon: {s.phone}</> : null}. Na zgłoszenia i reklamacje odpowiadamy najpóźniej w
          ciągu {SUPPORT_RESPONSE_DAYS} dni (zob.{" "}
          <Link href={`${REGULAMIN_PATH}#reklamacje`} className={link}>
            Regulamin §8
          </Link>
          ).
        </p>
      </LegalSection>

      <LegalSection id="faq" title="2. Najczęstsze pytania">
        <p>
          <strong className="text-white/90">Płatność przeszła, a pakiet nie działa.</strong> Odśwież stronę;
          jeśli po kilku minutach nic się nie zmienia, wyślij zgłoszenie z wybranym zamówieniem.
        </p>
        <p>
          <strong className="text-white/90">Chcę odstąpić od umowy lub zwrot.</strong> Zasady opisuje{" "}
          <Link href={`${REGULAMIN_PATH}`} className={link}>
            Regulamin
          </Link>
          ; zgłoś to formularzem poniżej lub e-mailem.
        </p>
        <p>
          <strong className="text-white/90">Chcę usunąć konto.</strong> Instrukcja:{" "}
          <Link href={DELETE_ACCOUNT_PATH} className={link}>
            Usuwanie konta
          </Link>
          .
        </p>
        <p>
          <strong className="text-white/90">Nie mogę się zalogować.</strong> Użyj „Nie pamiętasz hasła?” na
          ekranie logowania lub napisz do nas z adresu przypisanego do konta.
        </p>
      </LegalSection>

      <LegalSection id="formularz" title="3. Formularz zgłoszenia / reklamacji">
        {userId ? (
          <SupportForm orders={orders} defaultEmail={session?.user?.email ?? ""} />
        ) : (
          <p>
            Aby wysłać zgłoszenie z poziomu aplikacji,{" "}
            <Link href="/login?callbackUrl=/pomoc" className={link}>
              zaloguj się
            </Link>
            . Bez konta napisz na {s.email}.
          </p>
        )}
      </LegalSection>

      {mine.length > 0 ? (
        <LegalSection id="moje" title="4. Twoje zgłoszenia">
          <ul className="space-y-1">
            {mine.map((r) => (
              <li key={r.id}>
                {SUPPORT_KIND_LABELS[r.kind as SupportKind] ?? r.kind}: {r.subject} —{" "}
                {isSupportStatus(r.status) ? SUPPORT_STATUS_LABELS[r.status] : r.status} (odpowiedź do{" "}
                {supportDueLabel(r.dueAt)})
              </li>
            ))}
          </ul>
        </LegalSection>
      ) : null}
    </LegalDocShell>
  );
}
