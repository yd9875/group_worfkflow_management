import { prisma } from "@/lib/db";

export async function prepareAccountDeletion(userId: string) {
  const ownedOrganizations = await prisma.membership.findMany({
    where: { userId, role: "OWNER", status: "ACTIVE" },
    include: {
      organization: { select: { id: true, name: true } },
    },
  });

  if (!ownedOrganizations.length) return null;

  const organizationIds = ownedOrganizations.map(
    (membership) => membership.organizationId,
  );
  const organizationWithAnotherMember = await prisma.membership.findFirst({
    where: {
      organizationId: { in: organizationIds },
      userId: { not: userId },
      status: "ACTIVE",
    },
    include: { organization: { select: { name: true } } },
  });

  if (organizationWithAnotherMember) {
    return organizationWithAnotherMember.organization.name;
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.notification.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.schedule.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.joinRequest.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.membership.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.department.deleteMany({
      where: { organizationId: { in: organizationIds } },
    });
    await tx.organization.deleteMany({
      where: { id: { in: organizationIds } },
    });
  });

  return null;
}
