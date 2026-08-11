"use client";

import { useRouter } from "next/navigation";
import { AdminMfaPanel } from "@/components/AdminMfaPanel";

export function AdminMfaStep({ email }: { email: string }) {
  const router = useRouter();

  return <AdminMfaPanel email={email} onVerified={() => router.push("/admin/dashboard")} />;
}
