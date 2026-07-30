import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage({
  params,
}: {
  params: Promise<{ organizationId: string; section: string }>;
}) {
  const { organizationId, section } = await params;
  return <AdminPanel organizationId={organizationId} section={section} />;
}
