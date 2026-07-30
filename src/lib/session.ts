import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}

export async function requireMembership(
  organizationId: string,
  roles?: Array<"OWNER" | "ADMIN" | "MEMBER">,
) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: { userId: user.id, organizationId },
    },
    include: {
      user: true,
      organization: true,
      department: true,
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "이 조직에 접근할 권한이 없습니다.", 403);
  }
  if (roles && !roles.includes(membership.role)) {
    throw new AppError("FORBIDDEN", "이 작업을 수행할 권한이 없습니다.", 403);
  }
  return membership;
}
