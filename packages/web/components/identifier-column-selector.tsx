"use client";

interface IdentifierColumnSelectorProps {
  headers: string[];
  selectedColumn: string | null;
  identifierType:
    | "email"
    | "domain"
    | "website"
    | "linkedin_url"
    | "company_name"
    | "unknown";
  confidence: number;
  coverage: number;
  reasoning?: string;
  isDetecting?: boolean;
  onSelect: (column: string) => void;
  sampleValues?: string[];
  detectedFormat?: { format: string; confidence: number; matchedHeaders: string[] };
  suggestedColumn?: { column: string; coverage: number } | null;
  onSwitchToSuggested?: () => void;
}

const TYPE_BADGES: Record<
  IdentifierColumnSelectorProps["identifierType"],
  { label: string; classes: string }
> = {
  email: {
    label: "Email",
    classes: "bg-[#34D399]/8 text-[#34D399] border-[#34D399]/15",
  },
  domain: {
    label: "Domain",
    classes: "bg-[#60A5FA]/8 text-[#60A5FA] border-[#60A5FA]/15",
  },
  website: {
    label: "Website",
    classes: "bg-[#60A5FA]/8 text-[#60A5FA] border-[#60A5FA]/15",
  },
  linkedin_url: {
    label: "LinkedIn",
    classes: "bg-[#A5A0F6]/8 text-[#A5A0F6] border-[#A5A0F6]/15",
  },
  company_name: {
    label: "Name",
    classes: "bg-[#FBBF24]/8 text-[#FBBF24] border-[#FBBF24]/15",
  },
  unknown: {
    label: "Unknown",
    classes: "bg-[rgba(165,180,220,0.04)] text-[rgba(240,242,248,0.3)] border-[rgba(165,180,220,0.08)]",
  },
};

export function IdentifierColumnSelector({
  headers,
  selectedColumn,
  identifierType,
  confidence,
  coverage,
  reasoning,
  isDetecting,
  onSelect,
  sampleValues,
  detectedFormat,
  suggestedColumn,
  onSwitchToSuggested,
}: IdentifierColumnSelectorProps) {
  const coveragePercent = Math.round(coverage);

  let coverageColor = "text-[#34D399]";
  let coverageText = `${coveragePercent}% of rows have a value`;
  if (coveragePercent < 50) {
    coverageColor = "text-[#F87171]";
    coverageText = `${coveragePercent}% coverage \u2014 many rows will be skipped`;
  } else if (coveragePercent < 80) {
    coverageColor = "text-[#FBBF24]";
    coverageText = `${coveragePercent}% coverage`;
  }

  const badge = TYPE_BADGES[identifierType];

  const showSuggestion =
    suggestedColumn &&
    suggestedColumn.column !== selectedColumn &&
    onSwitchToSuggested;

  return (
    <div>
      <div className="text-[rgba(240,242,248,0.55)] text-sm font-semibold mb-1">Identifier column</div>
      <div className="text-[rgba(240,242,248,0.25)] text-xs mb-4 leading-relaxed">
        Select the column that identifies each company &mdash; email, domain,
        website URL, LinkedIn URL, or company name.
      </div>

      {detectedFormat && detectedFormat.confidence > 0.5 && (
        <span className="px-3 py-1.5 bg-[rgba(75,139,255,0.06)] border border-[rgba(75,139,255,0.12)] rounded-lg text-[#4B8BFF] text-[11px] font-semibold mb-3 inline-block">
          Detected: {detectedFormat.format}
        </span>
      )}

      {isDetecting && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4B8BFF] opacity-40" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4B8BFF]" />
            </span>
            <span className="text-[rgba(240,242,248,0.4)] text-sm">Analyzing columns with AI...</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {headers.slice(0, 6).map((_, i) => (
              <div
                key={i}
                className="h-9 rounded-xl bg-[rgba(11,16,34,0.5)] animate-pulse"
                style={{ width: `${60 + Math.random() * 40}px` }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2" style={{ display: isDetecting ? "none" : undefined }}>
        {headers.map((header) => {
          const isSelected = selectedColumn === header;
          return (
            <button
              key={header}
              type="button"
              onClick={() => onSelect(header)}
              className={`px-3 py-2 rounded-xl text-sm cursor-pointer transition-all duration-200 border inline-flex items-center gap-2 active:scale-[0.97] ${
                isSelected
                  ? "bg-[rgba(75,139,255,0.06)] border-[rgba(75,139,255,0.2)] text-[#4B8BFF]"
                  : "bg-[rgba(11,16,34,0.3)] border-[rgba(165,180,220,0.06)] text-[rgba(240,242,248,0.4)] hover:border-[rgba(165,180,220,0.12)] hover:text-[rgba(240,242,248,0.6)]"
              }`}
            >
              {header}
              {isSelected && (
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] border font-medium ${badge.classes}`}
                >
                  {badge.label}
                </span>
              )}
              {isSelected && confidence > 70 && (
                <span className="text-[11px] text-[#34D399] font-medium">Auto-detected</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedColumn && !isDetecting && (
        <div className={`mt-2.5 text-xs font-medium ${coverageColor}`}>{coverageText}</div>
      )}

      {reasoning && !isDetecting && (
        <div className="mt-1.5 text-[11px] text-[rgba(240,242,248,0.2)] italic">{reasoning}</div>
      )}

      {sampleValues && sampleValues.length > 0 && (
        <div className="mt-2.5 space-y-0.5">
          {sampleValues.slice(0, 3).map((val, idx) => (
            <div key={idx} className="font-mono text-[11px] text-[rgba(240,242,248,0.3)]">
              {val.length > 50 ? val.slice(0, 50) + "\u2026" : val}
            </div>
          ))}
        </div>
      )}

      {showSuggestion && (
        <div className="mt-2.5 text-xs text-[rgba(240,242,248,0.3)]">
          Tip: &lsquo;{suggestedColumn.column}&rsquo; has{" "}
          {Math.round(suggestedColumn.coverage)}% coverage.{" "}
          <button
            type="button"
            onClick={onSwitchToSuggested}
            className="text-[#4B8BFF] text-xs hover:underline font-medium"
          >
            Switch
          </button>
        </div>
      )}
    </div>
  );
}
