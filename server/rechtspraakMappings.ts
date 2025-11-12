export const rechtsgebiedMappings: Record<string, string> = {
  "civielrecht": "http://psi.rechtspraak.nl/rechtsgebied#civielRecht",
  "bestuursrecht": "http://psi.rechtspraak.nl/rechtsgebied#bestuursrecht",
  "strafrecht": "http://psi.rechtspraak.nl/rechtsgebied#strafRecht",
};

export const instantieMappings: Record<string, string> = {
  "hoge raad": "http://standaarden.overheid.nl/owms/terms/Hoge_Raad_der_Nederlanden",
  "rechtbank amsterdam": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Amsterdam",
  "rechtbank rotterdam": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Rotterdam",
  "rechtbank den haag": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Den_Haag",
  "rechtbank midden-nederland": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Midden-Nederland",
  "rechtbank noord-nederland": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Noord-Nederland",
  "rechtbank oost-brabant": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Oost-Brabant",
  "rechtbank zeeland-west-brabant": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Zeeland-West-Brabant",
  "rechtbank limburg": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Limburg",
  "rechtbank gelderland": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Gelderland",
  "rechtbank overijssel": "http://standaarden.overheid.nl/owms/terms/Rechtbank_Overijssel",
  "gerechtshof amsterdam": "http://standaarden.overheid.nl/owms/terms/Gerechtshof_Amsterdam",
  "gerechtshof arnhem-leeuwarden": "http://standaarden.overheid.nl/owms/terms/Gerechtshof_Arnhem-Leeuwarden",
  "gerechtshof den haag": "http://standaarden.overheid.nl/owms/terms/Gerechtshof_Den_Haag",
  "gerechtshof 's-hertogenbosch": "http://standaarden.overheid.nl/owms/terms/Gerechtshof_'s-Hertogenbosch",
  "centrale raad van beroep": "http://standaarden.overheid.nl/owms/terms/Centrale_Raad_van_Beroep",
  "college van beroep voor het bedrijfsleven": "http://standaarden.overheid.nl/owms/terms/College_van_Beroep_voor_het_bedrijfsleven",
  "raad van state": "http://standaarden.overheid.nl/owms/terms/Raad_van_State"
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
