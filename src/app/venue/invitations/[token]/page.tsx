import { AcceptVenueInvitation } from "@/components/AcceptVenueInvitation";

export default async function VenueInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return <AcceptVenueInvitation token={token} />;
}
