"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Button, Card, MultiSelect, Stack, Text, TextInput, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { redirectOnAuthError } from "@/lib/authErrorRedirect";
import { createCheckInList, type CheckInList } from "@/lib/checkInListApi";
import { listProducts, type Product } from "@/lib/productApi";

export default function NewCheckInListPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);
  const eventIdNum = Number(eventId);
  const router = useRouter();

  const products = useQuery({
    queryKey: ["products", eventIdNum],
    queryFn: () => listProducts(eventIdNum),
  });

  const form = useForm({
    initialValues: { name: "", product_ids: [] as string[] },
    validate: {
      name: (v) => (v.trim().length === 0 ? "Name is required" : null),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) =>
      createCheckInList(eventIdNum, {
        name: values.name,
        product_ids: values.product_ids.length > 0 ? values.product_ids.map(Number) : null,
      }),
    onSuccess: (data: { check_in_list: CheckInList }) =>
      router.push(`/events/${eventIdNum}/check-in-lists/${data.check_in_list.id}`),
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

  return (
    <Stack gap="xl" maw={560}>
      <Title order={2} fz={28}>
        New check-in list
      </Title>

      <Card withBorder radius="lg" p="xl">
        <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
          <Stack>
            <TextInput required label="Name" placeholder="Main Gate" {...form.getInputProps("name")} />
            <MultiSelect
              searchable
              clearable
              label="Limit to specific ticket types (optional)"
              description="Leave blank to accept every ticket type on this event."
              data={(products.data?.products ?? []).map((p: Product) => ({ value: String(p.id), label: p.title }))}
              {...form.getInputProps("product_ids")}
            />
            <Button type="submit" loading={createMutation.isPending} mt="sm">
              Create list
            </Button>
            <Text size="xs" c="dimmed">
              You&apos;ll get a public scan link and QR code to share with gate staff — no login required.
            </Text>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
