import { SchedulePage } from "@/components/schedule-page";

export default async function DayPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ organizationId }, search] = await Promise.all([params, searchParams]);
  return <SchedulePage organizationId={organizationId} view="day" search={search} />;
}
