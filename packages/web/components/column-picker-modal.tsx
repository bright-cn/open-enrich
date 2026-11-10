"use client";

import { X, Check } from "lucide-react";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getMappingsForCrm } from "@brightdata/enrich-core/csv/crm-mappings";

interface ColumnPickerModalProps {
  open: boolean;
  onClose: () => void;
  originalHeaders: string[];
  enrichmentFieldNames: string[];
  crmFormat: "salesforce" | "hubspot" | "raw";
  selectedColumns: Set<string>;
  onToggleColumn: (column: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onExport: () => void;
}

const CRM_LABELS: Record<string, string> = {
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  raw: "Raw CSV",
};

export default function ColumnPickerModal({
  open,
  onClose,
  originalHeaders,
  enrichmentFieldNames,
  crmFormat,
  selectedColumns,
  onToggleColumn,
  onSelectAll,
  onDeselectAll,
  onExport,
}: ColumnPickerModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const crmMappings =
    crmFormat !== "raw" ? getMappingsForCrm(crmFormat) : null;

  const allColumns = [...enrichmentFieldNames, ...originalHeaders];
  const allSelected = allColumns.every((col) => selectedColumns.has(col));

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 pb-8 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-[#0a1628]/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Content panel */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 bg-[#0b1022]/97 border border-[rgba(165,180,220,0.1)] rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-[0_24px_80px_rgba(6,9,26,0.9)] backdrop-blur-2xl"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[rgba(165,180,220,0.06)] flex items-center justify-between">
              <div>
                <h2 className="text-[#f0f2f8] font-bold tracking-tight">Choose export columns</h2>
                <p className="text-[11px] text-[rgba(240,242,248,0.35)] mt-0.5">
                  Exporting for {CRM_LABELS[crmFormat]}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Section: Enrichment Fields */}
              <h3 className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.3)] font-semibold mb-3">
                Enrichment fields
              </h3>
              {enrichmentFieldNames.map((field) => {
                const checked = selectedColumns.has(field);
                const mappedName =
                  crmMappings
                    ? crmMappings[field]?.crmField || "(custom)"
                    : null;

                return (
                  <div
                    key={`enrichment-${field}`}
                    className="flex items-center justify-between py-2.5 border-b border-[rgba(165,180,220,0.04)]"
                  >
                    <div className="flex items-center">
                      <button
                        onClick={() => onToggleColumn(field)}
                        className={`w-4 h-4 rounded-md border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                          checked
                            ? "bg-[#4B8BFF] border-[#4B8BFF]"
                            : "bg-[rgba(11,16,34,0.5)] border-[rgba(165,180,220,0.12)]"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className="text-sm text-[#f0f2f8] ml-3">{field}</span>
                    </div>
                    {mappedName && (
                      <span className="text-[11px] text-[rgba(240,242,248,0.3)] font-mono">
                        {mappedName}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Section: Original CSV Columns */}
              <h3 className="text-[11px] uppercase tracking-wider text-[rgba(240,242,248,0.3)] font-semibold mb-3 mt-6">
                Original CSV columns
              </h3>
              {originalHeaders.map((header) => {
                const checked = selectedColumns.has(header);

                return (
                  <div
                    key={`original-${header}`}
                    className="flex items-center justify-between py-2.5 border-b border-[rgba(165,180,220,0.04)]"
                  >
                    <div className="flex items-center">
                      <button
                        onClick={() => onToggleColumn(header)}
                        className={`w-4 h-4 rounded-md border transition-all duration-200 cursor-pointer flex items-center justify-center ${
                          checked
                            ? "bg-[#4B8BFF] border-[#4B8BFF]"
                            : "bg-[rgba(11,16,34,0.5)] border-[rgba(165,180,220,0.12)]"
                        }`}
                      >
                        {checked && <Check className="w-3 h-3 text-white" />}
                      </button>
                      <span className="text-sm text-[#f0f2f8] ml-3">{header}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[rgba(165,180,220,0.06)] flex items-center justify-between">
              <span
                onClick={allSelected ? onDeselectAll : onSelectAll}
                className="text-[11px] text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] cursor-pointer transition-colors font-medium"
              >
                {allSelected ? "Deselect all" : "Select all"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm text-[rgba(240,242,248,0.45)] hover:text-[#f0f2f8] transition-colors rounded-xl"
                >
                  Cancel
                </button>
                <button
                  onClick={onExport}
                  className="px-5 py-2.5 bg-[#4B8BFF] text-white text-sm font-semibold rounded-xl hover:bg-[#3A6FE0] transition-colors active:scale-[0.98]"
                >
                  Export {selectedColumns.size} columns
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
