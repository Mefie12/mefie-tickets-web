import { notFound } from "next/navigation";
import { backendRequest } from "@/lib/backend";
import { getAdminAuthState } from "@/lib/adminSession";
import type { AdminUser } from "@/lib/platformUserApi";
import { UserDetail } from "@/components/UserDetail";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const [result, state] = await Promise.all([
    backendRequest<{ user: AdminUser }>(`/api/admin/users/${userId}`),
    getAdminAuthState(),
  ]);

  if (result.status === 404) {
    notFound();
  }

  const permissions = state.status === "privileged" ? state.permissions : [];

  return <UserDetail initialUser={result.data.user} permissions={permissions} />;
}
