import { Suspense } from "react";
import { AcceptInvitationForm } from "@/components/AcceptInvitationForm";

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationForm />
    </Suspense>
  );
}
