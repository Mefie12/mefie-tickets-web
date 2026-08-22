"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Group, Pagination } from "@mantine/core";

export function EventPaginationControl({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(page));
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Group justify="center">
      <Pagination total={totalPages} value={currentPage} onChange={goToPage} />
    </Group>
  );
}
