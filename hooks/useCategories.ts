import useSWR from "swr";
import axios from "axios";
import type { CategoryDTO } from "@/types";

const fetcher = (url: string) =>
  axios.get<CategoryDTO[]>(url).then((r) => r.data);

export function useCategories() {
  const { data, error, isLoading } = useSWR("/api/categories", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  return {
    categories: data ?? [],
    error,
    isLoading,
  };
}
