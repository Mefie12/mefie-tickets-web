"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createShortLink, fetchShortLink, updateShortLink, type ShortLink, type ShortLinkTarget } from "@/lib/shortLink";

/** Shared query + mutations for an event's / series' short link (docs/26). */
export function useShortLink(target: ShortLinkTarget, id: number, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = ["short-link", target, id];
  const store = (link: ShortLink) => queryClient.setQueryData(queryKey, link);

  const query = useQuery({ queryKey, queryFn: () => fetchShortLink(target, id), enabled });
  const create = useMutation({ mutationFn: () => createShortLink(target, id), onSuccess: store });
  const update = useMutation({
    mutationFn: (changes: { enabled?: boolean; alias?: string | null }) => updateShortLink(target, id, changes),
    onSuccess: store,
  });

  return { link: query.data ?? null, query, create, update };
}
