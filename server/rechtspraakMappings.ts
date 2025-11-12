export const rechtsgebiedMappings: Record<string, string> = {
  "civielrecht": "http://psi.rechtspraak.nl/rechtsgebied#civielRecht",
  "bestuursrecht": "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht",
  "strafrecht": "http://psi.rechtspraak.nl/rechtsgebied#strafRecht",
};

export const instantieMappings: Record<string, string> = {
};

export function normalizeRechtsgebied(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();
  return rechtsgebiedMappings[normalized] || null;
}

export function normalizeInstantie(input: string | null | undefined): string | null {
  if (!input) return null;
  const normalized = input.toLowerCase().trim();
  return instantieMappings[normalized] || null;
}

export function normalizePeriode(input: string | null | undefined): { from: string; to: string } | null {
  if (!input) {
    const defaultYears = 5;
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - defaultYears);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  }

  const normalized = input.toLowerCase().trim();
  
  const laastMatch = normalized.match(/laatste\s+(\d+)\s+jaar/);
  if (laastMatch) {
    const years = parseInt(laastMatch[1], 10);
    const to = new Date();
    const from = new Date();
    from.setFullYear(from.getFullYear() - years);
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0]
    };
  }

  const rangeMatch = normalized.match(/(\d{4})[-–](\d{4})/);
  if (rangeMatch) {
    return {
      from: `${rangeMatch[1]}-01-01`,
      to: `${rangeMatch[2]}-12-31`
    };
  }

  const dateRangeMatch = normalized.match(/(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})/);
  if (dateRangeMatch) {
    return {
      from: dateRangeMatch[1],
      to: dateRangeMatch[2]
    };
  }

  return null;
}
