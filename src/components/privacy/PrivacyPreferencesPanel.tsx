"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Divider, Group, Stack, Switch, Text } from "@mantine/core";
import { getLegalDocumentsForPlacement } from "@/lib/legalDocumentsApi";
import { TermsAndConditionsLink } from "@/components/TermsAndConditionsLink";
import { currentChoices, readConsent } from "@/lib/privacyConsent";
import { joinNames, marketingPlatformNames, productImprovementToolNames } from "@/lib/analytics/config";
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
  const { savePreferences, closePreferences, marketingOffered } = usePrivacyConsent();
  // Default OFF for a visitor with no existing choice (spec §7, §17).
  const [productImprovement, setProductImprovement] = useState(() => currentChoices(readConsent()).productImprovement);
  const [marketing, setMarketing] = useState(() => currentChoices(readConsent()).marketing);
  const tools = joinNames(productImprovementToolNames());
  const platforms = joinNames(marketingPlatformNames());

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
          Helps us understand how Mefie is used so we can find problems and improve it.
          {tools ? ` Uses ${tools}, including a small sample of session recordings with typed text hidden.` : " Includes a small sample of session recordings with typed text hidden."}{" "}
          These tools may set cookies and receive technical data about your visit, such as the pages you view
          and your device type.
        </Text>
      </Stack>

      {marketingOffered && (
        <>
          <Divider />
          <Stack gap={4}>
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm">
                <Text fw={600}>Marketing</Text>
                <Badge variant="light">Optional</Badge>
              </Group>
              <Switch checked={marketing} onChange={(event) => setMarketing(event.currentTarget.checked)} aria-label="Marketing" />
            </Group>
            <Text size="sm" c="dimmed">
              Lets us measure how our advertising performs and show Mefie ads to people who looked at events,
              using the {platforms} {marketingPlatformNames().length > 1 ? "pixels" : "pixel"}.{" "}
              {marketingPlatformNames().length > 1 ? "These companies may" : "That company may"} use the data for their own purposes
              under their own policies. Off unless you turn it on.
            </Text>
          </Stack>
        </>
      )}

      <PrivacyPolicyLinks />

      <Group justify="flex-end">
        <Button
          onClick={() => {
            savePreferences({ productImprovement, marketing });
            closePreferences();
          }}
        >
          Save my choices
        </Button>
      </Group>
    </Stack>
  );
}
