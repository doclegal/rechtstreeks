import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

export function useCase(caseId: string | undefined) {
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["/api/cases", caseId],
    enabled: !!caseId,
    retry: false,
  });

  if (query.error && isUnauthorizedError(query.error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
  }

  return query;
}

export function useCases() {
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["/api/cases"],
    retry: false,
  });

  if (query.error && isUnauthorizedError(query.error)) {
    toast({
      title: "Unauthorized",
      description: "You are logged out. Logging in again...",
      variant: "destructive",
    });
    setTimeout(() => {
      window.location.href = "/api/login";
    }, 500);
  }

  return query;
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (caseData: any) => {
      const response = await apiRequest("POST", "/api/cases", caseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      toast({
        title: "Zaak aangemaakt",
        description: "Uw nieuwe zaak is succesvol aangemaakt",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Fout bij aanmaken zaak",
        description: "Er is een fout opgetreden bij het aanmaken van de zaak",
        variant: "destructive",
      });
    },
  });
}

export function useAnalyzeCase(caseId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/analyze`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      
      // Update toast message based on kanton check result
      if (data.kantonCheck) {
        if (data.kantonCheck.ok) {
          toast({
            title: "Kantonzaak controle geslaagd",
            description: "Uw zaak is geschikt voor het kantongerecht",
          });
        } else if (data.kantonCheck.reason === 'insufficient_info') {
          toast({
            title: "Meer informatie nodig",
            description: "Voeg meer documenten of informatie toe voor een volledige beoordeling",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Zaak niet geschikt",
            description: "Deze zaak is niet geschikt voor behandeling via het kantongerecht",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Analyse voltooid",
          description: "De AI-analyse van uw zaak is voltooid",
        });
      }
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      // Handle rate limiting specifically
      if (error.message.includes("429")) {
        toast({
          title: "Te snel geanalyseerd",
          description: "Wacht 2 minuten tussen analyses om kosten te beheersen. Probeer straks opnieuw.",
          variant: "destructive",
        });
        return;
      }
      
      // Handle service unavailable
      if (error.message.includes("503")) {
        toast({
          title: "Service tijdelijk niet beschikbaar",
          description: "De analyse service is momenteel niet beschikbaar. Probeer het later opnieuw.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Analyse mislukt",
        description: "Er is een fout opgetreden bij de analyse. Probeer het opnieuw.",
        variant: "destructive",
      });
    },
  });
}

export function useGenerateLetter(caseId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/cases/${caseId}/letter`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      toast({
        title: "Brief gegenereerd",
        description: "De brief is succesvol gegenereerd",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Brief generatie mislukt",
        description: "Er is een fout opgetreden bij het genereren van de brief",
        variant: "destructive",
      });
    },
  });
}

export function useOrderBailiff(caseId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/integrations/bailiff/serve", { caseId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
      toast({
        title: "Deurwaarder ingeschakeld",
        description: "De deurwaarder is ingeschakeld voor betekening",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Fout bij inschakelen deurwaarder",
        description: "Er is een fout opgetreden",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCase(caseId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (caseData: any) => {
      const response = await apiRequest("PATCH", `/api/cases/${caseId}`, caseData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cases", caseId] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Fout bij bijwerken zaak",
        description: "Er is een fout opgetreden bij het bijwerken van de zaak",
        variant: "destructive",
      });
    },
  });
}
