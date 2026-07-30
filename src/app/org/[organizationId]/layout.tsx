import { AppShell } from "@/components/app-shell";
import { getOrganizationContext } from "@/features/queries";

export const dynamic = "force-dynamic";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { membership, unreadCount } = await getOrganizationContext(organizationId);
  return (
    <AppShell
      organizationId={organizationId}
      organizationName={membership.organization.name}
      userName={membership.user.name}
      role={membership.role}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
