import { AppShell } from "@/components/app-shell";
import { getOrganizationShellContext } from "@/features/queries";

export const dynamic = "force-dynamic";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { membership, unreadCount, joinCode } =
    await getOrganizationShellContext(organizationId);
  return (
    <AppShell
      organizationId={organizationId}
      organizationName={membership.organization.name}
      joinCode={joinCode}
      userName={membership.profileName?.trim() || membership.user.name}
      role={membership.role}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
