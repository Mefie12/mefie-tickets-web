"use client";

import { useRouter } from "next/navigation";
import { Group, Pagination } from "@mantine/core";

/** Mirrors EventPaginationControl.tsx's approach, parametrized by basePath since this lives at a nested route. */
export function OrdersPagination({
  basePath,
  currentPage,
  totalPages,
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
}) {
  const router = useRouter();

  function goToPage(page: number) {
    router.push(page <= 1 ? basePath : `${basePath}?page=${page}`);
  }

  return (
    <Group justify="center">
      <Pagination total={totalPages} value={currentPage} onChange={goToPage} />
    </Group>
  );
}
