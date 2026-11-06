"use client";

import { useEffect } from "react";
import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Input, Stack } from "@mantine/core";

// Mirrors TicketDescriptionSanitizer::MAX_LENGTH on the API (sanitised HTML).
export const TICKET_DESCRIPTION_MAX_LENGTH = 1000;

/**
 * Optional light rich text for a ticket type or option: bold, italic
 * and lists only. Everything else (headings, links, quotes, code…) is
 * switched off in StarterKit so it can't be pasted in either — the API
 * sanitiser enforces the same list, this just keeps the editor honest.
 * Empty content is reported as "" (Tiptap's own empty doc is `<p></p>`).
 */
export function TicketDescriptionEditor({
  value,
  onChange,
  error,
  label = "Description",
  description = "Optional. What this ticket includes or any special info, e.g. “Entry for up to 5 people, 2 bottles of champagne”.",
}: {
  value: string;
  onChange: (value: string) => void;
  error?: React.ReactNode;
  label?: string;
  description?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: false,
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
  });

  // The tier cards in ProductsEditor are keyed by index, so removing or
  // reordering an option re-points this editor at a different value
  // without remounting it — Tiptap only reads `content` on mount, so
  // push external changes in (never our own echoes: those already match).
  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (current !== value) editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  const length = value.length;
  const tooLong = length > TICKET_DESCRIPTION_MAX_LENGTH;

  return (
    <Stack gap={5}>
      <Input.Label>{label}</Input.Label>
      <Input.Description>{description}</Input.Description>
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content mih={90} />
      </RichTextEditor>
      <Input.Description c={tooLong ? "red" : undefined} ta="right">
        {length}/{TICKET_DESCRIPTION_MAX_LENGTH}
      </Input.Description>
      {(error || tooLong) && <Input.Error>{error ?? "Description is too long."}</Input.Error>}
    </Stack>
  );
}
