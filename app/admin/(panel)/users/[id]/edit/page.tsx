import { AdminUserDetailClient } from "@/components/admin/admin-user-detail-client";

export default async function AdminUserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminUserDetailClient userId={id} editMode={true} />;
}
