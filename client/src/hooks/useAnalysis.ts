import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AnalysisSchema, type Analysis } from "@/lib/legalTypes";

interface UseAnalysisProps {
  caseId: string;
  enabled?: boolean;
}

export function useAnalysis({ caseId, enabled = true }: UseAnalysisProps) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["/api/cases", caseId, "analysis"],
    queryFn: async (): Promise<Analysis> => {
      const response = await apiRequest(`/api/cases/${caseId}/analysis`);
      if (!response.ok) {
        throw new Error("Failed to fetch analysis");
      }
      const jsonData = await response.json();
      return AnalysisSchema.parse(jsonData);
    },
    enabled: enabled && !!caseId,
    retry: false,
    staleTime: 300000, // 5 minutes
  });

  // Create a mutation for refreshing analysis with async polling
  const refreshMutation = useMutation({
    mutationFn: async (): Promise<Analysis> => {
      // Start the asynchronous analysis
      const response = await apiRequest(`/api/cases/${caseId}/analyze`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Analyse failed');
      }
      
      const result = await response.json();
      
      // If we got a threadId, start polling for results
      if (result.threadId && result.status === 'running') {
        return await pollForResult(result.threadId);
      }
      
      // If we got immediate results (fallback), return them
      if (result.analysis) {
        return AnalysisSchema.parse(result.analysis);
      }
      
      throw new Error('Geen analyse resultaat ontvangen');
    },
    onSuccess: (data) => {
      // Update the cache with new data and invalidate
      queryClient.setQueryData(["/api/cases", caseId, "analysis"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId, "analysis"] });
    },
    onError: (error: Error) => {
      console.error('Analysis mutation error:', error);
    }
  });

  // Polling function for asynchronous results
  const pollForResult = async (threadId: string, maxAttempts = 60): Promise<Analysis> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await apiRequest(`/api/mindstudio/result?threadId=${threadId}`);
        if (!response.ok) {
          throw new Error('Polling failed');
        }
        
        const result = await response.json();
        
        if (result.status === 'done' && result.processedResult) {
          // Save to database and return the processed analysis
          await saveAnalysisToDatabase(result, caseId);
          
          // Return the processed result as Analysis
          return AnalysisSchema.parse(result.processedResult);
        } else if (result.status === 'error') {
          throw new Error('MindStudio analyse gefaald');
        }
        
        // Wait 3 seconds before polling again
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Poll attempt ${attempt + 1} failed:`, error);
        if (attempt === maxAttempts - 1) {
          throw new Error('Analyse timeout - probeer later opnieuw');
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    throw new Error('Analyse duurt te lang - probeer later opnieuw');
  };

  // Save the processed result to the database
  const saveAnalysisToDatabase = async (result: any, caseId: string) => {
    if (!result.processedResult) return;
    
    try {
      const saveResponse = await apiRequest(`/api/cases/${caseId}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mindstudio-agent',
          rawText: result.outputText,
          factsJson: result.processedResult.factsJson,
          issuesJson: result.processedResult.issuesJson,
          legalBasisJson: result.processedResult.legalBasisJson,
          missingDocsJson: result.processedResult.missingDocuments,
          riskNotesJson: result.processedResult.riskNotesJson || []
        })
      });
      
      if (!saveResponse.ok) {
        console.error('Failed to save analysis to database');
      }
    } catch (error) {
      console.error('Error saving analysis to database:', error);
    }
  };

  return {
    ...query,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending
  };
}