import { useQuery } from "@tanstack/react-query";

export function useCases() {
  return useQuery({
    queryKey: ["/api/cases"],
    retry: false,
  });
}