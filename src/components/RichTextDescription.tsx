"use client";

import { RichTextEditor } from "@mantine/tiptap";
import { useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Input, Stack } from "@mantine/core";

export function RichTextDescription({ value, onChange, error, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  error?: React.ReactNode;
  disabled?: boolean;
}) {
  const editor = useEditor({
    // Tiptap v3's StarterKit bundles Link itself (unlike v2) — adding a
    // separate Link extension registers it twice under the same name.
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  return (
    <Stack gap={5}>
      <Input.Label required>Event description</Input.Label>
      <Input.Description>Tell attendees what to expect. You can add headings, lists, links, and emphasis.</Input.Description>
      <RichTextEditor editor={editor}>
        <RichTextEditor.Toolbar sticky stickyOffset={60}>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold /><RichTextEditor.Italic /><RichTextEditor.Underline /><RichTextEditor.Strikethrough />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.H2 /><RichTextEditor.H3 /><RichTextEditor.BulletList /><RichTextEditor.OrderedList />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup><RichTextEditor.Link /><RichTextEditor.Unlink /></RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content mih={180} />
      </RichTextEditor>
      {error && <Input.Error>{error}</Input.Error>}
    </Stack>
  );
}
