import { DistributorAllocationWorkspace } from "@/components/DistributorAllocationWorkspace";
export default async function DistributorAllocationPage({ params }: { params: Promise<{ allocationId: string }> }) { const { allocationId } = await params; return <DistributorAllocationWorkspace allocationId={Number(allocationId)} />; }
