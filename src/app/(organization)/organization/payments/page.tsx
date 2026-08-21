import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { getCurrentUser } from "@/lib/session";
import { PaymentsAndPayouts } from "@/components/PaymentsAndPayouts";
import type { PaymentAccount, PendingEarnings } from "@/lib/paymentAccountApi";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") notFound();
  const result = await backendRequest<{
    payment_account: PaymentAccount | null;
    pending_earnings: PendingEarnings | null;
    default_legal_country: string | null;
  }>("/api/organization/payments");
  if (result.status !== 200) notFound();
  return (
    <PaymentsAndPayouts
      initialAccount={result.data.payment_account}
      initialEarnings={result.data.pending_earnings}
      defaultLegalCountry={result.data.default_legal_country}
    />
  );
}
