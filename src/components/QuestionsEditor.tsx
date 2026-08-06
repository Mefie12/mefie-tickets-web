"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { IconChevronDown, IconChevronUp, IconHelpCircle, IconPlus, IconTrash, IconX } from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import {
  createQuestion,
  deleteQuestion,
  type Question,
  type QuestionScope,
  type QuestionType,
  updateQuestion,
} from "@/lib/questionApi";

const SCOPE_OPTIONS: { value: QuestionScope; label: string }[] = [
  { value: "ORDER", label: "Order — asked once per order" },
  { value: "ATTENDEE", label: "Attendee — asked for each attendee" },
];

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "TEXT", label: "Short text" },
  { value: "PARAGRAPH", label: "Paragraph" },
  { value: "SINGLE_SELECT", label: "Single select (dropdown)" },
  { value: "MULTI_SELECT", label: "Multi select (checkboxes)" },
  { value: "RADIO", label: "Radio buttons" },
  { value: "ADDRESS", label: "Address" },
  { value: "AGREEMENT", label: "Agreement (checkbox)" },
];

const OPTIONS_TYPES: QuestionType[] = ["SINGLE_SELECT", "MULTI_SELECT", "RADIO"];

type QuestionFormValues = {
  title: string;
  description: string;
  scope: QuestionScope;
  type: QuestionType;
  options: string[];
  is_required: boolean;
};

function questionToFormValues(question?: Question): QuestionFormValues {
  if (!question) {
    return { title: "", description: "", scope: "ATTENDEE", type: "TEXT", options: [], is_required: false };
  }
  return {
    title: question.title,
    description: question.description ?? "",
    scope: question.scope,
    type: question.type,
    options: question.options ?? [],
    is_required: question.is_required,
  };
}

export function QuestionsEditor({
  eventId,
  initialQuestions,
  disabled,
}: {
  eventId: number;
  initialQuestions: Question[];
  disabled: boolean;
}) {
  const [questions, setQuestions] = useState([...initialQuestions].sort((a, b) => a.sort_order - b.sort_order));
  const [modalQuestion, setModalQuestion] = useState<Question | "new" | null>(null);
  const router = useRouter();

  const reorderMutation = useMutation({
    mutationFn: async ({ a, b }: { a: Question; b: Question }) => {
      const [updatedA, updatedB] = await Promise.all([
        updateQuestion(eventId, a.id, { sort_order: b.sort_order }),
        updateQuestion(eventId, b.id, { sort_order: a.sort_order }),
      ]);
      return [updatedA.question, updatedB.question] as [Question, Question];
    },
    onSuccess: ([updatedA, updatedB]: [Question, Question]) => {
      setQuestions((prev) =>
        prev
          .map((q) => (q.id === updatedA.id ? updatedA : q.id === updatedB.id ? updatedB : q))
          .sort((a, b) => a.sort_order - b.sort_order),
      );
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (question: Question) => deleteQuestion(eventId, question.id),
    onSuccess: (_data: { message: string }, question: Question) => {
      setQuestions((prev) => prev.filter((q) => q.id !== question.id));
      notifications.show({ color: "teal", message: "Question deleted." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      notifications.show({ color: "red", message: error.message });
    },
  });

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Custom questions asked at checkout, per order or per attendee.
        </Text>
        {!disabled && (
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalQuestion("new")}>
            Add question
          </Button>
        )}
      </Group>

      {questions.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Stack align="center" gap="xs" py="lg">
            <IconHelpCircle size={32} opacity={0.5} />
            <Text c="dimmed" ta="center">
              No custom questions yet.
            </Text>
          </Stack>
        </Card>
      ) : (
        <Stack gap="sm">
          {questions.map((question, index) => (
            <Card key={question.id} withBorder radius="lg" p="md">
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={600}>{question.title}</Text>
                    <Badge size="sm" variant="light">
                      {question.scope}
                    </Badge>
                    <Badge size="sm" variant="light" color="grape">
                      {question.type}
                    </Badge>
                    {question.is_required && (
                      <Badge size="sm" color="orange" variant="light">
                        Required
                      </Badge>
                    )}
                  </Group>
                  {question.description && (
                    <Text size="sm" c="dimmed">
                      {question.description}
                    </Text>
                  )}
                </Stack>
                {!disabled && (
                  <Group gap={4} wrap="nowrap">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      disabled={index === 0 || reorderMutation.isPending}
                      onClick={() => reorderMutation.mutate({ a: question, b: questions[index - 1] })}
                    >
                      <IconChevronUp size={14} />
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      disabled={index === questions.length - 1 || reorderMutation.isPending}
                      onClick={() => reorderMutation.mutate({ a: question, b: questions[index + 1] })}
                    >
                      <IconChevronDown size={14} />
                    </ActionIcon>
                    <Button size="xs" variant="light" onClick={() => setModalQuestion(question)}>
                      Edit
                    </Button>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      loading={deleteMutation.isPending && deleteMutation.variables?.id === question.id}
                      onClick={() => deleteMutation.mutate(question)}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Group>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      {modalQuestion !== null && (
        <QuestionFormModal
          eventId={eventId}
          question={modalQuestion === "new" ? undefined : modalQuestion}
          nextSortOrder={questions.length}
          onClose={() => setModalQuestion(null)}
          onSaved={(saved) => {
            setQuestions((prev) => {
              const exists = prev.some((q) => q.id === saved.id);
              const next = exists ? prev.map((q) => (q.id === saved.id ? saved : q)) : [...prev, saved];
              return next.sort((a, b) => a.sort_order - b.sort_order);
            });
            setModalQuestion(null);
          }}
        />
      )}
    </Stack>
  );
}

function QuestionFormModal({
  eventId,
  question,
  nextSortOrder,
  onClose,
  onSaved,
}: {
  eventId: number;
  question?: Question;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (question: Question) => void;
}) {
  const isEdit = question !== undefined;
  const router = useRouter();

  const form = useForm<QuestionFormValues>({
    initialValues: questionToFormValues(question),
    validate: {
      title: (v) => (v.trim().length === 0 ? "Title is required" : null),
      options: (v, values) =>
        OPTIONS_TYPES.includes(values.type) && v.filter((o) => o.trim().length > 0).length < 2
          ? "Add at least 2 options"
          : null,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: QuestionFormValues) => {
      const input = {
        title: values.title,
        description: values.description || null,
        scope: values.scope,
        type: values.type,
        options: OPTIONS_TYPES.includes(values.type) ? values.options.filter((o) => o.trim().length > 0) : null,
        is_required: values.is_required,
        ...(isEdit ? {} : { sort_order: nextSortOrder }),
      };
      return isEdit ? updateQuestion(eventId, question.id, input) : createQuestion(eventId, input);
    },
    onSuccess: (data: { question: Question }) => {
      onSaved(data.question);
      notifications.show({ color: "teal", message: isEdit ? "Question updated." : "Question added." });
    },
    onError: (error: Error) => {
      if (redirectOnAuthError(error, router)) return;
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
      } else {
        notifications.show({ color: "red", message: error.message });
      }
    },
  });

  const showOptions = OPTIONS_TYPES.includes(form.values.type);

  return (
    <Modal opened onClose={onClose} title={isEdit ? "Edit question" : "Add question"} size="md">
      <form onSubmit={form.onSubmit((values) => saveMutation.mutate(values))}>
        <Stack>
          <TextInput label="Question" placeholder="What is your t-shirt size?" {...form.getInputProps("title")} />
          <Textarea label="Description (optional)" autosize minRows={1} {...form.getInputProps("description")} />
          <Select label="Asked" data={SCOPE_OPTIONS} allowDeselect={false} {...form.getInputProps("scope")} />
          <Select label="Answer type" data={TYPE_OPTIONS} allowDeselect={false} {...form.getInputProps("type")} />

          {showOptions && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Options
              </Text>
              {form.values.options.map((_, index) => (
                <Group key={index} gap="xs" wrap="nowrap">
                  <TextInput
                    style={{ flex: 1 }}
                    placeholder={`Option ${index + 1}`}
                    {...form.getInputProps(`options.${index}`)}
                  />
                  <ActionIcon variant="subtle" color="red" onClick={() => form.removeListItem("options", index)}>
                    <IconX size={14} />
                  </ActionIcon>
                </Group>
              ))}
              {typeof form.errors.options === "string" && (
                <Text size="xs" c="red">
                  {form.errors.options}
                </Text>
              )}
              <Button
                variant="light"
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => form.insertListItem("options", "")}
                style={{ alignSelf: "flex-start" }}
              >
                Add option
              </Button>
            </Stack>
          )}

          <Switch label="Required" {...form.getInputProps("is_required", { type: "checkbox" })} />

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {isEdit ? "Save changes" : "Add question"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
