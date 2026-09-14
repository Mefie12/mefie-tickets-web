"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Divider, Group, Stack, Switch, Text } from "@mantine/core";
import { getLegalDocumentsForPlacement } from "@/lib/legalDocumentsApi";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import { readConsent } from "@/lib/privacyConsent";
import { usePrivacyConsent } from "@/components/privacy/PrivacyConsentProvider";

/** Cookie Policy / Privacy Policy — whatever an admin has attached to the
 *  PRIVACY_CENTER placement. The panel just links to them (spec §14). */
function PrivacyPolicyLinks() {
  const query = useQuery({
    queryKey: ["legal-documents", "placement", "privacy-center"],
    queryFn: () => getLegalDocumentsForPlacement("privacy-center"),
  });
  const documents = query.data ?? [];
  if (documents.length === 0) return null;

  return (
    <Group gap="lg">
      {documents.map((document) => (
        <TermsAndConditionsLink
          key={document.slug}
          document={document}
          pdfUrl={`/api/public/legal-documents/${document.slug}/pdf`}
          label={document.name}
        />
      ))}
    </Group>
  );
}

export function PrivacyPreferencesPanel() {
  const { savePreferences, closePreferences } = usePrivacyConsent();
  // Default OFF for a visitor with no existing choice (spec §7, §17).
  const [productImprovement, setProductImprovement] = useState(() => readConsent()?.product_improvement ?? false);

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600}>Necessary</Text>
          <Group gap="sm" wrap="nowrap">
            <Badge variant="light" color="gray">
              Always on
            </Badge>
            <Switch checked readOnly aria-label="Necessary — always on, cannot be turned off" />
          </Group>
        </Group>
        <Text size="sm" c="dimmed">
          Required for Mefie to work, including sign-in, security, your basket and checkout.
        </Text>
      </Stack>

      <Divider />

      <Stack gap={4}>
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm">
            <Text fw={600}>Product improvement</Text>
            <Badge variant="light">Optional</Badge>
          </Group>
          <Switch
            checked={productImprovement}
            onChange={(event) => setProductImprovement(event.currentTarget.checked)}
            aria-label="Product improvement"
          />
        </Group>
        <Text size="sm" c="dimmed">
          Helps us understand how Mefie is used, including a small sample of session recordings, so we
          can find bugs and improve the experience.
        </Text>
      </Stack>

      <PrivacyPolicyLinks />

      <Group justify="flex-end">
        <Button
          onClick={() => {
            savePreferences(productImprovement);
            closePreferences();
          }}
        >
          Save my choices
        </Button>
      </Group>
    </Stack>
  );
}
