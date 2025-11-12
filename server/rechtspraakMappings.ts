export const rechtsgebiedMappings: Record<string, string> = {
  "huurrecht": "http://psi.rechtspraak.nl/rechtsgebied#huurrecht",
  "arbeidsrecht": "http://psi.rechtspraak.nl/rechtsgebied#arbeidsrecht",
  "consumentenkoop": "http://psi.rechtspraak.nl/rechtsgebied#consumentenkoop",
  "contractenrecht": "http://psi.rechtspraak.nl/rechtsgebied#contractenrecht",
  "aansprakelijkheidsrecht": "http://psi.rechtspraak.nl/rechtsgebied#aansprakelijkheidsrecht",
  "bestuursrecht": "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht",
  "belastingrecht": "http://psi.rechtspraak.nl/rechtsgebied#belastingrecht",
  "strafrecht": "http://psi.rechtspraak.nl/rechtsgebied#strafrecht",
  "civielrecht": "http://psi.rechtspraak.nl/rechtsgebied#civielrecht",
  "familierecht": "http://psi.rechtspraak.nl/rechtsgebied#familierecht",
  "insolventierecht": "http://psi.rechtspraak.nl/rechtsgebied#insolventierecht",
};

export const instantieMappings: Record<string, string> = {
  "hoge raad": "http://psi.rechtspraak.nl/creator#hogeraad",
  "hogeraad": "http://psi.rechtspraak.nl/creator#hogeraad",
  "gerechtshof": "http://psi.rechtspraak.nl/creator#gerechtshof",
  "gerechtshof amsterdam": "http://psi.rechtspraak.nl/creator#gerechtshofamsterdam",
  "gerechtshof arnhem-leeuwarden": "http://psi.rechtspraak.nl/creator#gerechtshofarnhemleeuwarden",
  "gerechtshof den haag": "http://psi.rechtspraak.nl/creator#gerechtshofdenhaag",
  "gerechtshof 's-hertogenbosch": "http://psi.rechtspraak.nl/creator#gerechtshofshertogenbosch",
  "rechtbank": "http://psi.rechtspraak.nl/creator#rechtbank",
  "kantonrechter": "http://psi.rechtspraak.nl/creator#rechtbank",
  "centrale raad van beroep": "http://psi.rechtspraak.nl/creator#centraleraadberoep",
  "college van beroep voor het bedrijfsleven": "http://psi.rechtspraak.nl/creator#collegeberoepbedrijfsleven",
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
