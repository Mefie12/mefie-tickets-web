"use client";

import { useMutation } from "@tanstack/react-query";
import { useForm } from "@mantine/form";
import { Button, PasswordInput, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { ApiError } from "@/lib/authApi";
import { adminLogin } from "@/lib/adminAuthApi";

/**
 * Platform staff sign in through the exact same /api/auth/login endpoint
 * as everyone else — there is one identity system, not a parallel admin
 * login (see decision in the platform-admin plan). This form only
 * differs from the ordinary login form in where it sends the visitor
 * afterward: /admin/mfa, to establish the privileged session, instead of
 * straight to /dashboard.
 */
export function AdminLoginForm({ defaultEmail = "", returnTo = "/admin/dashboard" }: { defaultEmail?: string; returnTo?: string }) {
  const form = useForm({
    initialValues: { email: defaultEmail, password: "" },
    validate: {
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Enter a valid email"),
      password: (v) => (v.length === 0 ? "Password is required" : null),
    },
  });

  const loginMutation = useMutation({
    mutationFn: (values: { email: string; password: string }) => adminLogin(values),
    onSuccess: () => {
      // The MFA page reads the newly issued session cookie on the server.
      // A full navigation ensures it uses the response from this login.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/admin/mfa?returnTo=${encodeURIComponent(returnTo)}`);
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
