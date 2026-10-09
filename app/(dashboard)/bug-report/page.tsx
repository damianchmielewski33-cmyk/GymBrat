import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BugReportForm } from "@/components/bug-report/bug-report-form";

export default async function BugReportPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/bug-report");
  }

  return (
    <div className="px-1 pt-1 sm:px-0">
      <BugReportForm />
    </div>
  );
}
