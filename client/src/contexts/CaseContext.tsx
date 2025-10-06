import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';

interface CaseContextType {
  selectedCaseId: string | null;
  setSelectedCaseId: (id: string | null) => void;
}

const CaseContext = createContext<CaseContextType | undefined>(undefined);

const SELECTED_CASE_KEY = 'selectedCaseId';

export function CaseProvider({ children }: { children: ReactNode }) {
  const [selectedCaseId, setSelectedCaseIdState] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SELECTED_CASE_KEY);
    }
    return null;
  });

  const setSelectedCaseId = (id: string | null) => {
    setSelectedCaseIdState(id);
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(SELECTED_CASE_KEY, id);
      } else {
        localStorage.removeItem(SELECTED_CASE_KEY);
      }
    }
  };

  return (
    <CaseContext.Provider value={{ selectedCaseId, setSelectedCaseId }}>
      {children}
    </CaseContext.Provider>
  );
}

export function useCaseContext() {
  const context = useContext(CaseContext);
  if (context === undefined) {
    throw new Error('useCaseContext must be used within a CaseProvider');
  }
  return context;
}

export function useActiveCase() {
  const { selectedCaseId } = useCaseContext();
  
  const { data: cases } = useQuery<any[]>({
    queryKey: ['/api/cases'],
  });

  if (!cases || cases.length === 0) {
    return null;
  }

  if (selectedCaseId) {
    const selectedCase = cases.find(c => c.id === selectedCaseId);
    if (selectedCase) {
      return selectedCase;
    }
  }

  const sortedCases = [...cases].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return sortedCases[0] || null;
}
