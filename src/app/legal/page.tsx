import type { Metadata } from "next";
import Link from "next/link";
import { Box, Container, Stack, Text, Title } from "@mantine/core";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { getFooterLegalDocuments } from "@/lib/legalServer";

export const metadata: Metadata = { title: "Legal | Mefie Tickets" };

export default async function LegalIndexPage() {
  const documents = await getFooterLegalDocuments();

  return (
    <Box>
      <PublicSiteHeader />
      <Container size="sm" py={{ base: 24, sm: 48 }}>
        <Stack gap="md">
          <Title order={1} size="h2">Legal</Title>
          <Text c="dimmed">The terms and policies that apply to using Mefie Tickets. You can read them without an account.</Text>
          {documents.length === 0 && <Text c="dimmed">No documents are published yet.</Text>}
          {documents.map((document) => (
            <Link key={document.slug} href={`/legal/${document.slug}`}>
              {document.name}
            </Link>
          ))}
        </Stack>
      </Container>
      <PublicSiteFooter />
    </Box>
  );
}
