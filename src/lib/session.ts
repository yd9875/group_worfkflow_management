import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
});

const findMembership = cache(async (userId: string, organizationId: string) =>
  prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId, organizationId },
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      departmentId: true,
      role: true,
      status: true,
      profileName: true,
      user: { select: { id: true, name: true, email: true } },
      organization: {
        select: { id: true, name: true, description: true, timezone: true },
      },
      department: {
        select: { id: true, name: true, isSystem: true, isActive: true },
      },
    },
  }),
);

export async function requireMembership(
  organizationId: string,
  roles?: Array<"OWNER" | "ADMIN" | "MEMBER">,
) {
  const user = await requireUser();
  const membership = await findMembership(user.id, organizationId);

  if (!membership || membership.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "이 조직에 접근할 권한이 없습니다.", 403);
  }
  if (roles && !roles.includes(membership.role)) {
    throw new AppError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.", 403);
  }
  return membership;
}
