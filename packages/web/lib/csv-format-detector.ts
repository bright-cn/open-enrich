export type CsvFormat =
  | "salesforce"
  | "hubspot"
  | "apollo"
  | "linkedin_sales_nav"
  | "zoominfo"
  | "speaker_list"
  | "generic";

interface FormatSignature {
  format: CsvFormat;
  headers: string[];
}

const FORMAT_SIGNATURES: FormatSignature[] = [
  {
    format: "salesforce",
    headers: [
      "account name",
      "industry",
      "billing city",
      "billing state",
      "annual revenue",
      "number of employees",
      "owner",
      "type",
      "lead source",
      "lead status",
    ],
  },
  {
    format: "hubspot",
    headers: [
      "company domain",
      "company name",
      "lifecycle stage",
      "hubspot owner",
      "create date",
      "number of associated contacts",
      "original source",
    ],
  },
  {
    format: "apollo",
    headers: [
      "first name",
      "last name",
      "person linkedin url",
      "company linkedin url",
      "email",
      "website",
      "# employees",
      "technologies",
      "email status",
    ],
  },
  {
    format: "linkedin_sales_nav",
    headers: [
      "first name",
      "last name",
      "company",
      "title",
      "geography",
      "linkedin url",
      "connected on",
    ],
  },
  {
    format: "zoominfo",
    headers: [
      "first name",
      "last name",
      "job title",
      "zoominfo contact id",
      "email address",
      "direct phone number",
      "company name",
      "website",
      "linkedin contact profile url",
    ],
  },
  {
    format: "speaker_list",
    headers: [
      "first name",
      "last name",
      "title",
      "company",
      "email",
      "country",
      "linkedin",
    ],
  },
];

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[_-]/g, " ").trim();
}

export function detectCsvFormat(headers: string[]): {
  format: CsvFormat;
  confidence: number;
  matchedHeaders: string[];
} {
  const normalizedHeaders = headers.map(normalizeHeader);

  let bestFormat: CsvFormat = "generic";
  let bestConfidence = 0;
  let bestMatched: string[] = [];

  for (const signature of FORMAT_SIGNATURES) {
    const matched: string[] = [];

    for (const sigHeader of signature.headers) {
      const normalizedSig = normalizeHeader(sigHeader);
      const matchIndex = normalizedHeaders.findIndex(
        (h) => h === normalizedSig
      );
      if (matchIndex !== -1) {
        matched.push(headers[matchIndex]);
      }
    }

    if (matched.length >= 3) {
      const confidence = matched.length / signature.headers.length;
      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestFormat = signature.format;
        bestMatched = matched;
      }
    }
  }

  return {
    format: bestFormat,
    confidence: bestConfidence,
    matchedHeaders: bestMatched,
  };
}

const FORMAT_IDENTIFIER_PRESETS: Record<CsvFormat, string[]> = {
  salesforce: ["email", "website", "account name"],
  hubspot: ["company domain", "email"],
  apollo: ["email", "person linkedin url", "website"],
  linkedin_sales_nav: ["linkedin url", "company"],
  zoominfo: ["email address", "website"],
  speaker_list: ["email", "first name"],
  generic: [],
};

export function getBestIdentifierColumn(
  format: CsvFormat,
  headers: string[]
): string | null {
  const presets = FORMAT_IDENTIFIER_PRESETS[format];
  if (!presets || presets.length === 0) {
    return null;
  }

  const normalizedHeaders = headers.map(normalizeHeader);

  for (const preset of presets) {
    const normalizedPreset = normalizeHeader(preset);
    const matchIndex = normalizedHeaders.findIndex(
      (h) => h === normalizedPreset
    );
    if (matchIndex !== -1) {
      return headers[matchIndex];
    }
  }

  return null;
}

const FIRST_NAME_VARIANTS = ["first name", "first_name", "fname", "given name", "first"];
const LAST_NAME_VARIANTS = ["last name", "last_name", "lname", "surname", "family name", "last"];
const FULL_NAME_VARIANTS = ["full name", "full_name", "name", "contact name", "person name"];

export function detectPersonColumns(headers: string[]): {
  firstNameCol: string | null;
  lastNameCol: string | null;
  fullNameCol: string | null;
} {
  const normalizedHeaders = headers.map(normalizeHeader);

  function findMatch(variants: string[]): string | null {
    for (const variant of variants) {
      const normalizedVariant = normalizeHeader(variant);
      const matchIndex = normalizedHeaders.findIndex(
        (h) => h === normalizedVariant
      );
      if (matchIndex !== -1) {
        return headers[matchIndex];
      }
    }
    return null;
  }

  return {
    firstNameCol: findMatch(FIRST_NAME_VARIANTS),
    lastNameCol: findMatch(LAST_NAME_VARIANTS),
    fullNameCol: findMatch(FULL_NAME_VARIANTS),
  };
}
