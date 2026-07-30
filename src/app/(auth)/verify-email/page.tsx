import { VerifyEmailCard } from "@/components/verify-email-card";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const params = await searchParams;
  return <VerifyEmailCard email={params.email} error={params.error} />;
}
