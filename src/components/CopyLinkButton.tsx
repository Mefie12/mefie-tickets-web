"use client";

import { Button, CopyButton } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";

/**
 * CopyButton's children is a render-prop function, which can't be passed
 * from a Server Component (functions aren't serializable across the RSC
 * boundary) — this wrapper isolates that render prop inside its own
 * "use client" component so a Server Component page can render it with
 * a plain string prop instead.
 */
export function CopyLinkButton({ value }: { value: string }) {
  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Button
          size="xs"
          variant="light"
          color={copied ? "teal" : undefined}
          leftSection={copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          onClick={copy}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      )}
    </CopyButton>
  );
}
