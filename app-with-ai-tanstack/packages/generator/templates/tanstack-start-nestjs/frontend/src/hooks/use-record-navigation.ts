import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { apiClient, type PaginatedResponse } from "@/lib/api-client";

interface UseRecordNavigationOptions {
  endpoint: string;
  params?: Record<string, unknown>;
  limit?: number;
  enabled?: boolean;
}

interface RecordNavigationResult<T = Record<string, unknown>> {
  records: T[];
  totalCount: number;
  currentIndex: number;
  currentRecord: T | null;
  isLoading: boolean;
  error: Error | null;
  page: number;
  totalPages: number;
  setCurrentIndex: (index: number) => void;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;
  goToPage: (page: number) => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  refetch: () => void;
}

export function useRecordNavigation<T = Record<string, unknown>>({
  endpoint,
  params,
  limit = 100,
  enabled = true,
}: UseRecordNavigationOptions): RecordNavigationResult<T> {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["ad-records", endpoint, params, page, limit],
    queryFn: () =>
      apiClient.get<PaginatedResponse<T>>(endpoint, {
        ...params,
        page,
        limit,
      }),
    enabled,
  });

  const records = useMemo(() => data?.data || [], [data]);
  const totalCount = data?.meta?.total || 0;
  const totalPages = data?.meta?.totalPages || 1;

  const currentRecord = records[currentIndex] || null;

  const goFirst = useCallback(() => {
    if (page > 1) {
      setPage(1);
      setCurrentIndex(0);
    } else {
      setCurrentIndex(0);
    }
  }, [page]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else if (page > 1) {
      setPage(page - 1);
      setCurrentIndex(limit - 1);
    }
  }, [currentIndex, page, limit]);

  const goNext = useCallback(() => {
    if (currentIndex < records.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (page < totalPages) {
      setPage(page + 1);
      setCurrentIndex(0);
    }
  }, [currentIndex, records.length, page, totalPages]);

  const goLast = useCallback(() => {
    if (page < totalPages) {
      setPage(totalPages);
      setCurrentIndex(0);
    } else {
      setCurrentIndex(records.length - 1);
    }
  }, [page, totalPages, records.length]);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
    setCurrentIndex(0);
  }, []);

  const globalIndex = (page - 1) * limit + currentIndex;
  const canGoPrev = globalIndex > 0;
  const canGoNext = globalIndex < totalCount - 1;

  return {
    records,
    totalCount,
    currentIndex,
    currentRecord,
    isLoading,
    error: error as Error | null,
    page,
    totalPages,
    setCurrentIndex,
    goFirst,
    goPrev,
    goNext,
    goLast,
    goToPage,
    canGoPrev,
    canGoNext,
    refetch,
  };
}
