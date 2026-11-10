"use client";

import Link from "next/link";
import { Group } from "@mantine/core";
import { useLegalDocuments } from "@/components/LegalDocumentLinks";

/** Compact "Terms · Privacy · …" row for client-rendered shells (auth pages, dashboards, portal). Renders nothing until documents load. */
export function LegalFooterLinks({ justify = "center" }: { justify?: "center" | "flex-start" }) {
  const { documents } = useLegalDocuments("public-footer");
  if (documents.length === 0) return null;

  return (
    <Group component="nav" aria-label="Legal" gap="md" justify={justify} py="md">
      {documents.map((document) => (
        <Link key={document.slug} href={`/legal/${document.slug}`} style={{ color: "var(--mantine-color-dimmed)", fontSize: "var(--mantine-font-size-xs)" }}>
          {document.name}
        </Link>
      ))}
    </Group>
  );
}
