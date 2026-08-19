import { AcceptComplimentaryInvitation } from "@/components/AcceptComplimentaryInvitation";
export default async function DistributorInvitationPage({ params }: { params: Promise<{ token: string }> }) { const { token } = await params; return <AcceptComplimentaryInvitation token={token} />; }
