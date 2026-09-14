"use client";

import { use } from "react";
import Link from "next/link";
import { Anchor, Stack } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { LegalDocumentEditor } from "@/components/LegalDocumentEditor";

export default function LegalDocumentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);

  return (
    <Stack gap="lg">
      <Anchor component={Link} href="/admin/platform-documents" size="sm" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <IconChevronLeft size={14} /> All legal documents
      </Anchor>
      <LegalDocumentEditor slug={slug} />
    </Stack>
  );
}
