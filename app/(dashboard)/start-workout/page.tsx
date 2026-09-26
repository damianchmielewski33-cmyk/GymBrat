import { redirect } from "next/navigation";

/** Start treningu jest teraz w hubie Treningi (`/workout-plan`). */
export default function StartWorkoutPage() {
  redirect("/workout-plan");
}
