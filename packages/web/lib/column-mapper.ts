import type { CSVRow } from "@brightdata/enrich-core";

interface MappingEntry {
  aliases: string[];
  internalField: string;
}

const COLUMN_MAPPINGS: MappingEntry[] = [
  {
    aliases: [
      "industry",
      "company industry",
      "account industry",
    ],
    internalField: "industry",
  },
  {
    aliases: [
      "employees",
      "employee count",
      "# employees",
      "number of employees",
      "company size",
      "headcount",
      "employees in linkedin",
    ],
    internalField: "employee_count",
  },
  {
    aliases: [
      "revenue",
      "annual revenue",
      "arr",
    ],
    internalField: "revenue",
  },
  {
    aliases: [
      "website",
      "company website",
      "url",
      "homepage",
      "web",
      "company url",
    ],
    internalField: "website",
  },
  {
    aliases: [
      "linkedin",
      "linkedin url",
      "linkedin profile",
      "company linkedin url",
      "person linkedin url",
      "linkedin company page url",
    ],
    internalField: "linkedin_url",
  },
  {
    aliases: [
      "description",
      "company description",
      "about",
      "bio",
    ],
    internalField: "description",
  },
  {
    aliases: [
      "city",
      "billing city",
      "hq city",
      "location",
      "geography",
      "hq location",
    ],
    internalField: "headquarters",
  },
  {
    aliases: [
      "founded",
      "founded year",
      "year founded",
    ],
    internalField: "founded_year",
  },
  {
    aliases: [
      "technologies",
      "tech stack",
      "tools",
    ],
    internalField: "tech_stack",
  },
  {
    aliases: [
      "phone",
      "direct phone",
      "phone number",
      "direct phone number",
    ],
    internalField: "phone",
  },
  {
    aliases: [
      "title",
      "job title",
      "person title",
    ],
    internalField: "title",
  },
  {
    aliases: [
      "funding",
      "funding stage",
      "last funding type",
    ],
    internalField: "funding_stage",
  },
  {
    aliases: [
      "twitter",
      "twitter handle",
      "twitter url",
    ],
    internalField: "twitter_url",
  },
  {
    aliases: [
      "github",
      "github url",
      "github profile",
    ],
    internalField: "github_url",
  },
];

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[_-]/g, " ").trim();
}

const CURRENCY_REGEX = /^[\$\€\£]?\s*[\d,]+(\.\d+)?\s*[MmBbKk]?$/;
const NUMERIC_REGEX = /^[\d,]+(\.\d+)?$/;

function assessQuality(
  internalField: string,
  values: string[]
): "good" | "low" | "empty" {
  const nonEmpty = values.filter((v) => v.trim().length > 0);
  const coverage = nonEmpty.length / values.length;

  if (coverage <= 0.2) {
    return "empty";
  }

  let invalidCount = 0;

  switch (internalField) {
    case "revenue": {
      for (const v of nonEmpty) {
        const trimmed = v.trim();
        if (!CURRENCY_REGEX.test(trimmed) && !NUMERIC_REGEX.test(trimmed)) {
          invalidCount++;
        }
      }
      break;
    }
    case "employee_count": {
      for (const v of nonEmpty) {
        const trimmed = v.trim().replace(/,/g, "");
        if (!/^\d+$/.test(trimmed)) {
          invalidCount++;
        }
      }
      break;
    }
    case "website": {
      for (const v of nonEmpty) {
        if (!v.includes(".")) {
          invalidCount++;
        }
      }
      break;
    }
    case "linkedin_url": {
      for (const v of nonEmpty) {
        if (!v.toLowerCase().includes("linkedin.com")) {
          invalidCount++;
        }
      }
      break;
    }
    default:
      return "good";
  }

  const invalidRatio = invalidCount / nonEmpty.length;
  if (invalidRatio > 0.3) {
    return "low";
  }

  return "good";
}

export function mapExistingColumns(
  headers: string[],
  rows: CSVRow[],
  sampleSize: number = 200
): Map<
  string,
  {
    internalField: string;
    headerName: string;
    coverage: number;
    quality: "good" | "low" | "empty";
  }
> {
  const result = new Map<
    string,
    {
      internalField: string;
      headerName: string;
      coverage: number;
      quality: "good" | "low" | "empty";
    }
  >();

  const sampleRows = rows.slice(0, sampleSize);
  if (sampleRows.length === 0) {
    return result;
  }

  const normalizedLookup = new Map<string, MappingEntry>();
  for (const mapping of COLUMN_MAPPINGS) {
    for (const alias of mapping.aliases) {
      normalizedLookup.set(normalizeHeader(alias), mapping);
    }
  }

  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const mapping = normalizedLookup.get(normalized);
    if (!mapping) {
      continue;
    }

    const values = sampleRows.map((row) => row[header] ?? "");
    const nonEmptyCount = values.filter((v) => v.trim().length > 0).length;
    const coverage = nonEmptyCount / sampleRows.length;
    const quality = assessQuality(mapping.internalField, values);

    result.set(header, {
      internalField: mapping.internalField,
      headerName: header,
      coverage,
      quality,
    });
  }

  return result;
}
