import { TechniqueVideosClient } from "@/components/technique/technique-videos-client";

export const metadata = { title: "Technika" };

export default function TechniquePage() {
  return (
    <div className="px-1 pt-1 sm:px-0">
      <TechniqueVideosClient />
    </div>
  );
}
