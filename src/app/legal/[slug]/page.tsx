import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Button, Container, Stack } from "@mantine/core";
import { LegalDocumentView } from "@/components/LegalDocumentView";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { getPublishedLegalDocument } from "@/lib/legalServer";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const document = await getPublishedLegalDocument(slug);
  return document ? { title: `${document.name} | Mefie Tickets` } : {};
}

export default async function LegalDocumentPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const document = await getPublishedLegalDocument(slug);
  if (!document) notFound();

  const pdfUrl = `/api/public/legal-documents/${encodeURIComponent(document.slug)}/pdf`;

  return (
    <Box>
      <PublicSiteHeader />
      <Container size="md" py={{ base: 24, sm: 48 }}>
        <Stack gap="lg">
          {document.content_type === "PDF" ? (
            <>
              <LegalDocumentView title={document.name} versionNumber={document.version_number} publishedAt={document.published_at} html="" />
              <Button component="a" href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "flex-start" }}>
                Open the PDF
              </Button>
              <iframe src={pdfUrl} title={document.name} style={{ width: "100%", height: "80vh", border: "1px solid var(--mantine-color-default-border)", borderRadius: 8 }} />
            </>
          ) : (
            <LegalDocumentView title={document.name} versionNumber={document.version_number} publishedAt={document.published_at} html={document.rich_text_content ?? ""} />
          )}
        </Stack>
      </Container>
      <PublicSiteFooter />
    </Box>
  );
}
