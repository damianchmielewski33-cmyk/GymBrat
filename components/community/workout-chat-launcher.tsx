"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { WorkoutChatPanel } from "@/components/community/workout-chat-panel";
import { useCommunityWorkoutStore } from "@/lib/stores/community-workout";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";

/**
 * Pływający Workout Chat podczas treningu grupowego (active-workout).
 */
export function WorkoutChatLauncher() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const mode = useCommunityWorkoutStore((s) => s.mode);
  const groupSessionId = useCommunityWorkoutStore((s) => s.groupSessionId);
  const hasSession = useActiveWorkoutStore(
    (s) => s.exercises.length > 0 && s.workoutStartedAtMs != null,
  );

  const userId = session?.user?.id;
  const onActiveWorkout = pathname.startsWith("/active-workout");
  const show =
    mode === "group" &&
    !!groupSessionId &&
    !!userId &&
    hasSession &&
    onActiveWorkout;

  if (!show || !groupSessionId || !userId) return null;

  return (
    <div className="pointer-events-auto fixed bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] left-3 right-3 z-[65] md:left-auto md:right-4 md:w-[min(100%,24rem)]">
      <WorkoutChatPanel
        key={groupSessionId}
        target={{ kind: "workout", groupSessionId }}
        viewerUserId={userId}
        compact
      />
    </div>
  );
}
