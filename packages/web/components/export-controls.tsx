"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Download, Copy, Check } from "lucide-react";
import {
  exportCrmCsv,
  exportRawCsv,
  exportJson,
  exportTsv,
  triggerDownload,
  copyToClipboard,
} from "@brightdata/enrich-core/csv/format";

interface ExportControlsProps {
  results: Array<{
    originalData: Record<string, string>;
    enrichments: Record<
      string,
      {
        value: unknown;
        confidence: number;
        sourceContext?: Array<{ url: string }>;
        scrapedAt?: string;
      }
    >;
    status: string;
  }>;
  originalHeaders: string[];
  enrichmentFieldNames: string[];
}

export default function ExportControls({
  results,
  originalHeaders,
  enrichmentFieldNames,
}: ExportControlsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleExportSalesforce() {
    const csv = exportCrmCsv(
      results,
      "salesforce",
      originalHeaders,
      enrichmentFieldNames,
      true
    );
    triggerDownload(csv, "salesforce_export.csv");
    setIsOpen(false);
  }

  function handleExportHubSpot() {
    const csv = exportCrmCsv(
      results,
      "hubspot",
      originalHeaders,
      enrichmentFieldNames,
      true
    );
    triggerDownload(csv, "hubspot_export.csv");
    setIsOpen(false);
  }

  function handleExportRawCsv() {
    const csv = exportRawCsv(results, originalHeaders, enrichmentFieldNames);
    triggerDownload(csv, "enrichment-results.csv");
    setIsOpen(false);
  }

  async function handleCopyJson() {
    const json = exportJson(results, enrichmentFieldNames);
    await copyToClipboard(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setIsOpen(false);
  }

  async function handleCopyTsv() {
    const tsv = exportTsv(results, originalHeaders, enrichmentFieldNames);
    await copyToClipboard(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setIsOpen(false);
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 bg-[rgba(11,16,34,0.5)] border border-[rgba(165,180,220,0.1)] rounded-xl text-sm text-[#f0f2f8] inline-flex items-center gap-2 hover:bg-[rgba(11,16,34,0.7)] hover:border-[rgba(165,180,220,0.15)] transition-all duration-200 active:scale-[0.98]"
      >
        {copied ? (
          <>
            <Check size={16} className="text-[#34D399]" />
            <span className="text-[#34D399]">Copied</span>
          </>
        ) : (
          <>
            Export
            <ChevronDown size={16} className="text-[rgba(240,242,248,0.4)]" />
          </>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-[#0b1022]/97 border border-[rgba(165,180,220,0.1)] rounded-xl shadow-[0_16px_48px_rgba(6,9,26,0.8)] backdrop-blur-2xl z-20 py-1 overflow-hidden">
          <button
            onClick={handleExportSalesforce}
            className="w-full px-4 py-2.5 text-left text-sm text-[rgba(240,242,248,0.65)] hover:bg-[rgba(75,139,255,0.04)] hover:text-[#f0f2f8] transition-colors flex items-center gap-2.5"
          >
            <Download size={15} className="text-[rgba(240,242,248,0.3)]" />
            Export for Salesforce
          </button>
          <button
            onClick={handleExportHubSpot}
            className="w-full px-4 py-2.5 text-left text-sm text-[rgba(240,242,248,0.65)] hover:bg-[rgba(75,139,255,0.04)] hover:text-[#f0f2f8] transition-colors flex items-center gap-2.5"
          >
            <Download size={15} className="text-[rgba(240,242,248,0.3)]" />
            Export for HubSpot
          </button>
          <button
            onClick={handleExportRawCsv}
            className="w-full px-4 py-2.5 text-left text-sm text-[rgba(240,242,248,0.65)] hover:bg-[rgba(75,139,255,0.04)] hover:text-[#f0f2f8] transition-colors flex items-center gap-2.5"
          >
            <Download size={15} className="text-[rgba(240,242,248,0.3)]" />
            Raw CSV
          </button>

          <div className="border-t border-[rgba(165,180,220,0.06)] my-1" />

          <button
            onClick={handleCopyJson}
            className="w-full px-4 py-2.5 text-left text-sm text-[rgba(240,242,248,0.65)] hover:bg-[rgba(75,139,255,0.04)] hover:text-[#f0f2f8] transition-colors flex items-center gap-2.5"
          >
            <Copy size={15} className="text-[rgba(240,242,248,0.3)]" />
            Copy JSON
          </button>
          <button
            onClick={handleCopyTsv}
            className="w-full px-4 py-2.5 text-left text-sm text-[rgba(240,242,248,0.65)] hover:bg-[rgba(75,139,255,0.04)] hover:text-[#f0f2f8] transition-colors flex items-center gap-2.5"
          >
            <Copy size={15} className="text-[rgba(240,242,248,0.3)]" />
            Copy for Google Sheets
          </button>
        </div>
      )}
    </div>
  );
}
