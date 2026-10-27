import { redirect } from "next/navigation";

type PageProps = {
  searchParams?: Promise<{ edit?: string }>;
};

/** Stara ścieżka Profil → Plan: trwałe przekierowanie na /plany (AC-1.3, AC-1.4). */
export default async function ProfileWorkoutPlanRedirectPage({
  searchParams,
}: PageProps) {
  const params = await (searchParams ?? Promise.resolve({} as { edit?: string }));
  const editId =
    typeof params.edit === "string" && params.edit.trim()
      ? params.edit.trim()
      : null;
  if (editId) {
    redirect(`/plany/${encodeURIComponent(editId)}`);
  }
  redirect("/plany");
}
