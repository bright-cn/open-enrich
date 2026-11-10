"use client";

import { Sparkles, AlertTriangle } from "lucide-react";
import { IdentifierColumnSelector } from "./identifier-column-selector";
import { FieldSelector } from "./field-selector";
import { CustomFieldBuilder } from "./custom-field-builder";
import type { EnrichmentField } from "@brightdata/enrich-core";

interface EnrichmentConfigProps {
  headers: string[];
  identifierColumn: string | null;
  identifierType:
    | "email"
    | "domain"
    | "website"
    | "linkedin_url"
    | "company_name"
    | "unknown";
  identifierConfidence: number;
  identifierCoverage: number;
  identifierReasoning?: string;
  isDetecting?: boolean;
  onIdentifierColumnChange: (col: string) => void;
  selectedFields: Set<string>;
  toggleField: (name: string) => void;
  selectCategory: (category: string) => void;
  clearCategory: (category: string) => void;
  getCategoryFields: (
    category: string
  ) => Array<{ name: string; displayName: string; description: string }>;
  isCategoryFullySelected: (category: string) => boolean;
  categories: [string, string][];
  customFields: EnrichmentField[];
  onAddCustomField: (field: EnrichmentField) => void;
  onRemoveCustomField: (name: string) => void;
  bundles: Array<{ id: string; name: string; description: string; fieldKeys: string[]; estimatedSeconds: number }>;
  selectBundle: (bundleId: string) => void;
  isBundleSelected: (bundleId: string) => boolean;
  totalRows: number;
  totalIdentified: number;
  onStart: () => void;
  isRunning: boolean;
  sampleValues?: string[];
  detectedFormat?: {
    format: string;
    confidence: number;
    matchedHeaders: string[];
  };
  suggestedColumn?: { column: string; coverage: number } | null;
  onSwitchToSuggested?: () => void;
  skippedFieldCount?: number;
}

export function EnrichmentConfig({
  headers,
  identifierColumn,
  identifierType,
  identifierConfidence,
  identifierCoverage,
  identifierReasoning,
  isDetecting,
  onIdentifierColumnChange,
  selectedFields,
  toggleField,
  selectCategory,
  clearCategory,
  getCategoryFields,
  isCategoryFullySelected,
  categories,
  customFields,
  onAddCustomField,
  onRemoveCustomField,
  bundles,
  selectBundle,
  isBundleSelected,
  totalRows,
  totalIdentified,
  onStart,
  isRunning,
  sampleValues,
  detectedFormat,
  suggestedColumn,
  onSwitchToSuggested,
  skippedFieldCount = 0,
}: EnrichmentConfigProps) {
  const fieldCount = selectedFields.size;
  const isDisabled =
    isRunning || !identifierColumn || fieldCount === 0;

  return (
    <div className="space-y-10">
      <IdentifierColumnSelector
        headers={headers}
        selectedColumn={identifierColumn}
        identifierType={identifierType}
        confidence={identifierConfidence}
        coverage={identifierCoverage}
        reasoning={identifierReasoning}
        isDetecting={isDetecting}
        onSelect={onIdentifierColumnChange}
        sampleValues={sampleValues}
        detectedFormat={detectedFormat}
        suggestedColumn={suggestedColumn}
        onSwitchToSuggested={onSwitchToSuggested}
      />

      <FieldSelector
        selectedFields={selectedFields}
        toggleField={toggleField}
        selectCategory={selectCategory}
        clearCategory={clearCategory}
        getCategoryFields={getCategoryFields}
        isCategoryFullySelected={isCategoryFullySelected}
        categories={categories}
        bundles={bundles}
        selectBundle={selectBundle}
        isBundleSelected={isBundleSelected}
      />

      <CustomFieldBuilder
        customFields={customFields}
        onAdd={onAddCustomField}
        onRemove={onRemoveCustomField}
      />

      <div className="flex items-center justify-between pt-6 border-t border-[rgba(165,180,220,0.06)]">
        <div className="flex flex-col gap-1">
          <span className="text-[rgba(240,242,248,0.45)] text-sm tabular-nums">
            Enriching {totalIdentified} of {totalRows} rows with {fieldCount}{" "}
            fields
          </span>
          {skippedFieldCount > 0 && (
            <span className="text-[rgba(240,242,248,0.2)] text-[11px]">
              Saved ~{skippedFieldCount * totalIdentified} lookups by skipping{" "}
              {skippedFieldCount} fields already in CSV
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={isDisabled}
          onClick={onStart}
          className="group relative px-8 py-3.5 bg-gradient-to-r from-[#A5A0F6] via-[#4B8BFF] to-[#22D3EE] text-white font-semibold rounded-xl shadow-[0_0_24px_rgba(75,139,255,0.2),0_0_48px_rgba(75,139,255,0.08)] hover:shadow-[0_0_32px_rgba(75,139,255,0.35),0_0_64px_rgba(75,139,255,0.12)] hover:translate-y-[-1px] active:translate-y-0 active:scale-[0.98] transition-all duration-250 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none inline-flex items-center gap-2"
        >
          {identifierCoverage < 50 && (
            <AlertTriangle size={18} className="text-[#FBBF24]" />
          )}
          <Sparkles size={18} />
          <span className="relative z-10">Start enrichment</span>
          <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
      </div>
    </div>
  );
}
