import Link from "next/link";

export function HofSeasonArchive({
  archive,
}: {
  archive: Array<{ key: string; title: string; kind: string }>;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-[18px] font-semibold text-white">
        Archiwum sezonów
      </h2>
      {archive.length === 0 ? (
        <p className="text-[13px] text-white/40">
          Po zamknięciu okresów pojawią się tu oficjalne podia.
        </p>
      ) : (
        <ul className="space-y-2">
          {archive.map((s) => (
            <li key={s.key}>
              <Link
                href={`/community/hall-of-fame?period=${s.kind === "all_time" ? "week" : s.kind}`}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[13px] transition hover:border-[var(--gym-gold)]/30"
              >
                <span className="text-white">{s.title}</span>
                <span className="text-white/40">{s.key}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
