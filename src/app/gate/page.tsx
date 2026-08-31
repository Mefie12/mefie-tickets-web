import { GateSignIn } from "@/components/GateSignIn";

export const dynamic = "force-dynamic";

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; list?: string; label?: string }>;
}) {
  const sp = await searchParams;
  return <GateSignIn defaults={sp} />;
}
