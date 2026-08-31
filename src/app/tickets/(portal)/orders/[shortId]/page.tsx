import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import type { OrderDetailPayload } from "@/lib/portalApi";
import { PortalOrderView } from "@/components/PortalOrderView";

export const dynamic = "force-dynamic";

export default async function PortalOrderPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const result = await backendRequest<OrderDetailPayload>(
    `/api/portal/orders/${encodeURIComponent(shortId)}`,
  );

  if (result.status === 404) notFound();
  if (result.status !== 200) {
    throw new Error("Could not load this order.");
  }

  return <PortalOrderView shortId={shortId} initialData={result.data} />;
}
