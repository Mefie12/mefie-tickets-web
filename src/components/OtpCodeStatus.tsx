import { Alert, PinInput, Text, type PinInputProps } from "@mantine/core";
import { IconClockPause } from "@tabler/icons-react";
import { formatMMSS } from "@/lib/otpTiming";

/** "Code expires in 14:32" — flips to a red expired notice at zero. */
export function OtpExpiry({ seconds, expired, known = true }: { seconds: number; expired: boolean; known?: boolean }) {
  if (!known) return null;
  return expired ? (
    <Text size="sm" c="red" ta="center" role="alert">
      This code expired. Send a new one to continue.
    </Text>
  ) : (
    <Text size="sm" c="dimmed" ta="center">
      This code expires in {formatMMSS(seconds)}.
    </Text>
  );
}

/**
 * Shown while the server is making the user wait; counts down live and disappears at zero.
 * The message is announced once by assistive tech; the ticking number is excluded from the live
 * region (`aria-live="off"`) so a screen reader doesn't read out every second.
 */
export function OtpBlockedNotice({ message, seconds }: { message: string | null; seconds: number }) {
  return (
    <Alert color="yellow" variant="light" icon={<IconClockPause size={18} />} role="status">
      {message ?? "Please wait before trying again."} Try again in <strong aria-live="off">{formatMMSS(seconds)}</strong>.
    </Alert>
  );
}

/** The six-box code entry, centred in whatever column it sits in (a bare PinInput hugs the left edge). */
export function OtpPinInput({ style, ...props }: PinInputProps) {
  return <PinInput length={6} type="number" oneTimeCode style={{ justifyContent: "center", ...style }} {...props} />;
}
