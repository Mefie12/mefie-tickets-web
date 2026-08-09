import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthLayout } from "@/components/AuthLayout";
import { VerifyEmailRedirect } from "@/components/VerifyEmailRedirect";

export default async function VerifyEmailPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.email_verified_at) {
    redirect("/dashboard");
  }

  return (
    <AuthLayout title="Verify your email" subtitle={`Enter the 6-digit code we sent to ${user.email}.`}>
      <VerifyEmailRedirect expiresAt={user.email_verification_code_expires_at} />
    </AuthLayout>
  );
}
