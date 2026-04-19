import useSWRInfinite from "swr/infinite";
import axios from "axios";
import type { PaginatedResponse, VideoDTO } from "@/types";

const PER_PAGE = 10;

const fetcher = (url: string) =>
  axios.get<PaginatedResponse<VideoDTO>>(url).then((r) => r.data);

export function useVideos(category?: string) {
  const getKey = (
    pageIndex: number,
    previousData: PaginatedResponse<VideoDTO> | null
  ) => {
    if (previousData && !previousData.has_more) return null;

    const params = new URLSearchParams({
      page: String(pageIndex + 1),
      per_page: String(PER_PAGE),
    });
    if (category) params.set("category", category);

    return `/api/videos?${params.toString()}`;
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite(getKey, fetcher, {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
    });

  const videos = data?.flatMap((page) => page.data) ?? [];
  const isLoadingMore = isValidating && size > (data?.length ?? 0);
  const hasMore = data ? data[data.length - 1]?.has_more : true;
  const total = data?.[0]?.total ?? 0;

  return {
    videos,
    total,
    error,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore: () => setSize((s) => s + 1),
    mutate,
  };
}
