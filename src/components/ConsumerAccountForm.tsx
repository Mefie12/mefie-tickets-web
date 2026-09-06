"use client";
import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Anchor, Button, PinInput, Stack, Text, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@tanstack/react-query";
import { AuthLayout } from "@/components/AuthLayout";
import { PhoneInput } from "@/components/PhoneInput";
import { LegalDocumentLinks } from "@/components/LegalDocumentLinks";
import { getLegalDocumentsForPlacement } from "@/lib/legalDocumentsApi";
import { safeNext } from "@/lib/safeNext";

export function ConsumerAccountForm({ signup = false }: { signup?: boolean }) {
  return <Suspense><AccountForm signup={signup}/></Suspense>;
}
function AccountForm({ signup }: { signup: boolean }) {
  const router = useRouter(); const params = useSearchParams();
  const [proof, setProof] = useState(() => params.get("ticketProof"));
  useEffect(() => { if (proof) window.history.replaceState(null, "", "/login"); }, [proof]);
  const [step, setStep] = useState<"details" | "code" | "complete">("details");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [code, setCode] = useState(""); const [masked, setMasked] = useState("");
  const form = useForm({ initialValues: { email: "", first_name: "", last_name: "", phone: "" } });
  const legal = useQuery({ queryKey: ["legal-documents", "placement", "account-registration"], queryFn: () => getLegalDocumentsForPlacement("account-registration") });
  const needsDetails = step === "complete" || (signup && step === "details");
  const documents = (legal.data ?? []).map(document => document.version_id);
  async function submit(action: "request" | "verify" | "complete") {
    setBusy(true); setError("");
    try {
      const body = action === "verify" ? { code } : { ...form.values, intent: signup ? "register" : "login", document_versions: documents, ...(proof && action === "request" ? { ticket_proof: proof } : {}) };
      const res = await fetch(`/api/public/consumer/account/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { form.setErrors(Object.fromEntries(Object.entries(data.errors ?? {}).map(([key, value]) => [key, (value as string[])[0]]))); throw new Error(data.message ?? "Please try again."); }
      if (data.status === "authenticated") { window.location.assign(safeNext(params.get("next"), "consumer", "/tickets")); return; }
      if (data.status === "completion_required") { setStep("complete"); return; }
      setMasked(data.masked_email); setCode(""); setStep("code");
      if (proof) router.replace("/login");
    } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <AuthLayout title={step === "code" ? "Check your email" : step === "complete" ? "Complete your account" : signup ? "Create your ticket account" : "Log in to My Tickets"} subtitle={step === "code" ? `Enter the six-digit code sent to ${masked}.` : "Buy, receive, and access your tickets with email. No password needed."}>
    <form onSubmit={e => { e.preventDefault(); void submit(step === "code" ? "verify" : step === "complete" ? "complete" : "request"); }}>
      <Stack>
        {params.get("expired") === "1" && <Alert color="orange">Your session expired. Verify your email to continue.</Alert>}
        {error && <Alert color="red" role="alert">{error}</Alert>}
        {step === "code" ? <><PinInput length={6} type="number" oneTimeCode value={code} onChange={setCode} aria-label="Email verification code"/><Button type="submit" loading={busy} disabled={code.length !== 6}>Verify email</Button><Button variant="subtle" disabled={busy} onClick={() => submit("request")}>Send another code</Button><Button variant="subtle" onClick={() => { setStep("details"); setCode(""); setProof(null); }}>Change email</Button></> : <>
          {step === "details" && !proof && <TextInput label="Email" type="email" required autoComplete="email" {...form.getInputProps("email")}/>}
          {step === "details" && proof && <Text size="sm">We’ll email a code to this ticket’s designated recipient.</Text>}
          {needsDetails && <><TextInput label="First name" required autoComplete="given-name" {...form.getInputProps("first_name")}/><TextInput label="Last name" required autoComplete="family-name" {...form.getInputProps("last_name")}/><PhoneInput label="Phone" required {...form.getInputProps("phone")}/>
            <Text size="xs" c="dimmed">By creating an account you agree to our <LegalDocumentLinks placement="account-registration" fallback="Terms of Use and Privacy Policy"/>.</Text>
            {legal.isError && <Alert color="red">Unable to load account documents. Please reload to try again.</Alert>}
          </>}
          <Button type="submit" loading={busy} disabled={needsDetails && (legal.isPending || legal.isError)}>{step === "complete" ? "Create account" : "Continue with email"}</Button>
        </>}
        <Text size="sm" ta="center">{signup ? "Already have tickets? " : "New to Mefie? "}<Anchor component={Link} href={signup ? "/login" : "/register"}>{signup ? "Log in" : "Sign up"}</Anchor></Text>
        <Text size="sm" ta="center"><Anchor component={Link} href="/organizers/login">Organizer login</Anchor></Text>
      </Stack>
    </form>
  </AuthLayout>;
}
