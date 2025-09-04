import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AnalysisSchema, type Analysis } from "@/lib/legalTypes";
import { ZodError } from "zod";

interface UseAnalysisProps {
  caseId: string;
  enabled?: boolean;
}

export function useAnalysis({ caseId, enabled = true }: UseAnalysisProps) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["/api/analyse", caseId],
    queryFn: async (): Promise<Analysis> => {
      try {
        // Call the analysis endpoint with case data
        const response = await apiRequest(
          "POST",
          "/api/analyse",
          {
            input_case_details: `Case ID: ${caseId}`,
            extracted_text: "Extracted document text for analysis"
          }
        );

        // Parse JSON response
        const jsonData = await response.json();
        
        // Validate the response with Zod schema
        const validatedData = AnalysisSchema.parse(jsonData);
        return validatedData;
      } catch (error) {
        if (error instanceof ZodError) {
          console.error("Analysis schema validation failed:", error.errors);
          throw new Error("Ongeldig analyseformat ontvangen van server");
        }
        
        if (error instanceof Error) {
          throw error;
        }
        
        throw new Error("Onbekende fout bij ophalen analyse");
      }
    },
    enabled,
    retry: 2,
    retryDelay: 1000,
    staleTime: 0, // Always fetch fresh data
  });

  // Create a mutation for refreshing analysis
  const refreshMutation = useMutation({
    mutationFn: async (): Promise<Analysis> => {
      // Invalidate existing cache first
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/analyse", caseId] 
      });
      
      // Call the analysis endpoint
      const response = await apiRequest(
        "POST",
        "/api/analyse",
        {
          input_case_details: `Case ID: ${caseId}`,
          extracted_text: "Extracted document text for analysis"
        }
      );

      const jsonData = await response.json();
      const validatedData = AnalysisSchema.parse(jsonData);
      
      // Update the cache with new data
      queryClient.setQueryData(["/api/analyse", caseId], validatedData);
      
      return validatedData;
    },
    onSuccess: () => {
      // Ensure the query is refetched
      queryClient.invalidateQueries({ 
        queryKey: ["/api/analyse", caseId] 
      });
    }
  });

  return {
    ...query,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending
  };
}