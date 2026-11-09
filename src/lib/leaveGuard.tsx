"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { modals } from "@mantine/modals";
import { Text } from "@mantine/core";
import { UNSAVED_ATTENTION_EVENT } from "@/components/forms/SaveBar";
import { useUnsaved } from "@/lib/useUnsaved";
import { unsavedRegistry } from "@/lib/unsavedChangesRegistry";
import { linkGuardTarget } from "@/lib/linkGuard";

const TITLE_MARK = "● ";
const AWAY_MS = 30_000;

/**
 * "Leave without saving?": one dialog for every in-app exit. Keep editing is the default; leaving
 * names what would be lost. Resolves true only when the organizer chooses to leave.
 */
export function confirmLeave(): Promise<boolean> {
  const labels = unsavedRegistry.getSnapshot().dirtyLabels;
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    modals.openConfirmModal({
      title: "Leave without saving?",
      centered: true,
      children: (
        <Text size="sm">
          {labels.length > 0 ? `You have unsaved changes in ${labels.join(", ")}.` : "You have unsaved changes."} If you leave now, they will be lost.
        </Text>
      ),
      labels: { confirm: "Leave without saving", cancel: "Keep editing" },
      confirmProps: { color: "red", variant: "light" },
      cancelProps: { variant: "filled" },
      onConfirm: () => settle(true),
      onCancel: () => settle(false),
      onClose: () => settle(false),
    });
  });
}

let unloadAllowed = false;

/**
 * Call right before a deliberate full-page navigation the organizer already confirmed (sign-out),
 * so the browser does not ask a second time.
 */
export function allowUnload() {
  unloadAllowed = true;
}

type NavigateEventLike = {
  navigationType: string;
  cancelable: boolean;
  destination?: { key?: string; sameDocument?: boolean };
  preventDefault: () => void;
};
type NavigationLike = {
  addEventListener: (type: "navigate", listener: (event: NavigateEventLike) => void) => void;
  removeEventListener: (type: "navigate", listener: (event: NavigateEventLike) => void) => void;
  traverseTo: (key: string) => { finished: Promise<unknown> };
};

/**
 * Mount once in each shell that hosts forms. While any form has unsaved edits it:
 * - asks before any in-app link takes the organizer away (one page-wide click guard, so links inside
 *   forms, menus and dialogs are covered the same way as the sidebar);
 * - asks the browser to confirm refresh, close and address-bar exits (generic text; browsers don't allow custom);
 * - confirms Back/Forward within the app via the Navigation API where the browser supports it and the
 *   navigation can be cancelled (best effort; other browsers fall back to the above);
 * - marks the tab title so a distracted organizer notices from another tab;
 * - and, if they come back after being away, asks the save bar for one gentle highlight.
 */
export function useLeaveGuard() {
  const router = useRouter();
  const { dirtyIds } = useUnsaved();
  const dirty = dirtyIds.length > 0;

  // Capture phase on the document runs before React's own handlers, so a held click never reaches
  // the Link (or the browser's default navigation) unless the organizer chooses to leave.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const destination = linkGuardTarget(
        {
          href: anchor.getAttribute("href") ?? "",
          target: anchor.getAttribute("target"),
          download: anchor.hasAttribute("download"),
          button: event.button,
          modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey,
        },
        { origin: window.location.origin, pathname: window.location.pathname, search: window.location.search },
      );
      if (destination === null) return;
      event.preventDefault();
      event.stopPropagation();
      void confirmLeave().then((leave) => {
        if (!leave) return;
        if (destination.startsWith("/api/")) {
          allowUnload();
          window.location.assign(destination);
        } else {
          router.push(destination);
        }
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty, router]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (unloadAllowed) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const navigation = (window as unknown as { navigation?: NavigationLike }).navigation;
    if (!navigation?.addEventListener) return;
    let bypass = false;
    const onNavigate = (event: NavigateEventLike) => {
      if (bypass || event.navigationType !== "traverse" || !event.cancelable) return;
      if (event.destination?.sameDocument === false) return; // a real page load: beforeunload handles it
      event.preventDefault();
      const key = event.destination?.key;
      void confirmLeave().then((leave) => {
        if (!leave || !key) return;
        bypass = true;
        navigation.traverseTo(key).finished.catch(() => undefined).finally(() => {
          bypass = false;
        });
      });
    };
    navigation.addEventListener("navigate", onNavigate);
    return () => navigation.removeEventListener("navigate", onNavigate);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const original = document.title.startsWith(TITLE_MARK) ? document.title.slice(TITLE_MARK.length) : document.title;
    document.title = TITLE_MARK + original;
    return () => {
      if (document.title.startsWith(TITLE_MARK)) document.title = document.title.slice(TITLE_MARK.length);
    };
  }, [dirty]);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= AWAY_MS && unsavedRegistry.getSnapshot().dirtyIds.length > 0) {
        window.dispatchEvent(new Event(UNSAVED_ATTENTION_EVENT));
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}
