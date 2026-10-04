/** Returned by the API when an event's dates change while scanners are already set up for it. */
export type ScannerNotice = { prepared_scanners: number; message: string };

export type NoticeToast = { color: string; title: string; message: string; autoClose: number };

/**
 * Tickets survive a reschedule, but scanners that already downloaded their roster only learn the new
 * dates when they are next online — so the organizer is told, and the toast stays up long enough to read.
 */
export function scannerNoticeToast(notice: ScannerNotice | undefined | null): NoticeToast | null {
  if (!notice || notice.prepared_scanners < 1) return null;

  return { color: "orange", title: "Tell your gate staff", message: notice.message, autoClose: 15_000 };
}
