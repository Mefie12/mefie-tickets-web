"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError, login, type CurrentUser } from "@/lib/authApi";

/**
 * Platform staff sign in through the exact same /api/auth/login endpoint
 * as everyone else — there is one identity system, not a parallel admin
 * login (see decision in the platform-admin plan). This form only
 * differs from the ordinary login form in where it sends the visitor
 * afterward: /admin/mfa, to establish the privileged session, instead of
 * straight to /dashboard.
 */
export function AdminLoginForm() {
  const router = useRouter();

  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      password: (v) => (v.length === 0 ? "Password is required" : null),
    },
  });

  const loginMutation = useMutation({
    mutationFn: (values: { email: string; password: string }) => login(values),
    onSuccess: (data: { user: CurrentUser }) => {
      if (!data.user.email_verified_at) {
        router.push("/verify-email");
        return;
      }
      router.push("/admin/mfa");
    },
    onError: (error: Error) => {
      if (error instanceof ApiError && error.errors) {
        form.setErrors(
          Object.fromEntries(Object.entries(error.errors).map(([field, messages]) => [field, messages[0]])),
        );
      } else {
        notifications.show({ color: "red", message: (error as Error).message });
      }
    },
  });

  return (
    <form onSubmit={form.onSubmit((values) => loginMutation.mutate(values))}>
      <Stack>
        <TextInput label="Email" placeholder="you@example.com" {...form.getInputProps("email")} />
        <PasswordInput label="Password" {...form.getInputProps("password")} />
        <Button type="submit" fullWidth loading={loginMutation.isPending} mt="sm">
          Continue
        </Button>
      </Stack>
    </form>
  );
}
