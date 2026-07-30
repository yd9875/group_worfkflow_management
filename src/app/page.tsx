import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const preference = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });
  if (preference?.lastOrganizationId) {
    redirect(
      `/org/${preference.lastOrganizationId}/schedule/${preference.defaultScheduleView.toLowerCase()}`,
    );
  }
  redirect("/organizations");
}
