import Link from "next/link";
import type { ActivityPostView } from "@/lib/community/activity-feed";

export function ActivityFeedList({
  posts,
  empty,
}: {
  posts: ActivityPostView[];
  empty: string;
}) {
  if (posts.length === 0) {
    return <p className="text-[13px] text-white/40">{empty}</p>;
  }
  return (
    <ul className="space-y-2">
      {posts.map((p) => (
        <li
          key={p.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link
                href={`/community/u/${p.userId}`}
                className="text-[13px] font-medium text-[var(--gym-gold)] hover:underline"
              >
                {p.displayName}
              </Link>
              <p className="mt-0.5 text-[14px] text-white">{p.title}</p>
              {p.body ? (
                <p className="mt-1 text-[12px] text-white/45">{p.body}</p>
              ) : null}
            </div>
            <span className="shrink-0 text-[11px] text-white/35">
              {p.createdAt.toLocaleDateString("pl-PL")}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
