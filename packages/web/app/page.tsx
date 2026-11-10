"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BarChart3, X } from "lucide-react";
import Header from "@/components/header";
import CSVUploader from "@/components/csv-uploader";
import { EnrichmentConfig } from "@/components/enrichment-config";
import EnrichmentProgress from "@/components/enrichment-progress";
import EnrichmentTable from "@/components/enrichment-table";
import ExportControls from "@/components/export-controls";
import { OutboundSummaryCards } from "@/components/outbound-summary-cards";
import { FilterBar } from "@/components/filter-bar";
import { EnrichmentReportPanel } from "@/components/enrichment-report";
import { MCPSettingsPanel } from "@/components/mcp-settings-panel";
import { EmailNotificationToggle } from "@/components/email-notification-toggle";
import CostTicker from "@/components/cost-ticker";
import { useCSVParser } from "@/hooks/use-csv-parser";
import { useFieldConfig } from "@/hooks/use-field-config";
import { useEnrichment } from "@/hooks/use-enrichment";
import DemoLimitModal from "@/components/demo-limit-modal";
import { useFilters } from "@/hooks/use-filters";
import { classifyRows } from "@/lib/outbound-scoring";
import { applyFilters } from "@/lib/filter-utils";
import { generateReport } from "@/lib/report-generator";
import { withBasePath } from "@/lib/base-path";


type Step = "upload" | "configure" | "results";

type IdentifierType =
  | "email"
  | "domain"
  | "website"
  | "linkedin_url"
  | "company_name"
  | "unknown";

const spring = { duration: 0.5, ease: [0.32, 0.72, 0, 1] as const };
const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] } },
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
const URL_REGEX = /^https?:\/\/.+/;
const LINKEDIN_REGEX = /linkedin\.com\/(company|in)\//i;

function detectIdentifierType(values: string[]): IdentifierType {
  const nonEmpty = values.filter((v) => v && v.trim().length > 0);
  if (nonEmpty.length === 0) return "unknown";

  let emailCount = 0;
  let domainCount = 0;
  let linkedinCount = 0;
  let urlCount = 0;

  for (const v of nonEmpty) {
    const trimmed = v.trim();
    if (EMAIL_REGEX.test(trimmed)) emailCount++;
    if (LINKEDIN_REGEX.test(trimmed)) linkedinCount++;
    else if (URL_REGEX.test(trimmed)) urlCount++;
    else if (DOMAIN_REGEX.test(trimmed)) domainCount++;
  }

  const total = nonEmpty.length;
  if (emailCount / total > 0.5) return "email";
  if (linkedinCount / total > 0.5) return "linkedin_url";
  if (urlCount / total > 0.5) return "website";
  if (domainCount / total > 0.5) return "domain";
  return "company_name";
}

function computeCoverage(
  rows: Record<string, string>[],
  column: string | null
): number {
  if (!column || rows.length === 0) return 0;
  const filled = rows.filter(
    (r) => r[column] && r[column].trim().length > 0
  ).length;
  return (filled / rows.length) * 100;
}

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [identifierColumn, setIdentifierColumn] = useState<string | null>(null);

  const csv = useCSVParser();
  const fields = useFieldConfig();
  const enrichment = useEnrichment();
  const tableFilters = useFilters();
  const [reportOpen, setReportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emailNotifyEnabled, setEmailNotifyEnabled] = useState(false);
  const [emailNotifyAddress, setEmailNotifyAddress] = useState("");
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailNotifyError, setEmailNotifyError] = useState<string | null>(null);
  const enrichmentStartRef = useRef<number | null>(null);
  const settingsOpenedRef = useRef(false);

  const isComplete = !enrichment.isRunning && enrichment.results.length > 0;

  const outboundClassification = useMemo(() => {
    if (!isComplete) return null;
    return classifyRows(enrichment.results, fields.allFields.map((f) => f.name));
  }, [enrichment.results, fields.allFields, isComplete]);

  const { filtered: filteredResults, counts: filterCounts } = useMemo(() => {
    const segmentSets = outboundClassification
      ? {
          fully_enriched: outboundClassification.fullyEnriched,
          buying_signal: outboundClassification.hasBuyingSignal,
          needs_review: outboundClassification.needsReview,
        }
      : undefined;
    return applyFilters(enrichment.results, tableFilters.filters, segmentSets);
  }, [enrichment.results, tableFilters.filters, outboundClassification]);

  const enrichmentReport = useMemo(() => {
    if (!isComplete) return null;
    return generateReport(
      enrichment.results,
      fields.allFields.map((f) => f.name),
      enrichment.totalCost
    );
  }, [enrichment.results, fields.allFields, isComplete, enrichment.totalCost]);

  useEffect(() => {
    fetch(withBasePath("/api/email-settings"))
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          setEmailNotifyAddress(data.email || "");
          setEmailConfigured(data.configured || false);
        }
      })
      .catch(() => {});
  }, []);

  // Track when settings panel has been opened
  useEffect(() => {
    if (settingsOpen) {
      settingsOpenedRef.current = true;
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen && settingsOpenedRef.current) {
      fetch(withBasePath("/api/email-settings"))
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setEmailNotifyAddress(data.email || "");
            setEmailConfigured(data.configured || false);
          }
        })
        .catch(() => {});
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (!isComplete || !emailNotifyEnabled || !emailNotifyAddress) return;

    const startTime = enrichmentStartRef.current;
    if (!startTime) return;

    const elapsed = Date.now() - startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    const duration = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    const successCount = enrichment.results.filter((r) => r.status === "completed").length;
    const errorCount = enrichment.results.filter((r) => r.status === "error").length;

    fetch(withBasePath("/api/send-notification"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: emailNotifyAddress,
        totalRows: enrichment.progress.total,
        successCount,
        errorCount,
        totalCost: enrichment.totalCost.totalCost,
        duration,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          setEmailNotifyError(data.error || "Couldn't send notification");
        }
      })
      .catch(() => {
        setEmailNotifyError("Couldn't send notification");
      });

    enrichmentStartRef.current = null;
  }, [isComplete, emailNotifyEnabled, emailNotifyAddress, enrichment.results, enrichment.progress.total, enrichment.totalCost.totalCost]);

  function handleFileAccepted(file: File) {
    csv.parseFile(file);
  }

  function handleContinueToConfigure() {
    if (csv.result) {
      const col = csv.result.identifierColumn;
      if (col) {
        setIdentifierColumn(col);
      }
    }
    setStep("configure");
  }

  function handleIdentifierColumnChange(col: string) {
    setIdentifierColumn(col);
  }

  function handleStartEnrichment() {
    if (!csv.result || !identifierColumn) return;
    console.log("[page] selectedFields Set:", [...fields.selectedFields]);
    console.log("[page] allFields array:", fields.allFields.map((f) => f.name));
    console.log("[page] rows count:", csv.result.rows.length);
    console.log("[page] identifierColumn:", identifierColumn);
    enrichmentStartRef.current = Date.now();
    setEmailNotifyError(null);
    enrichment.start(csv.result.rows, fields.allFields, identifierColumn);
    setStep("results");
  }

  function handleBackToUpload() {
    setStep("upload");
    enrichment.reset();
  }

  function handleBackToConfigure() {
    setStep("configure");
    enrichment.reset();
  }

  const csvReady = csv.result && csv.result.rows.length > 0 && !csv.result.error;

  const identifierCoverage = useMemo(() => {
    if (!csv.result) return 0;
    return computeCoverage(csv.result.rows, identifierColumn);
  }, [csv.result, identifierColumn]);

  const totalIdentified = useMemo(() => {
    if (!csv.result || !identifierColumn) return 0;
    return csv.result.rows.filter(
      (r) => r[identifierColumn] && r[identifierColumn].trim().length > 0
    ).length;
  }, [csv.result, identifierColumn]);

  const identifierType: IdentifierType = useMemo(() => {
    if (!csv.result || !identifierColumn) return "unknown";
    const values = csv.result.rows.map((r) => r[identifierColumn] ?? "");
    return detectIdentifierType(values);
  }, [csv.result, identifierColumn]);

  const sampleValues = useMemo(() => {
    if (!csv.result || !identifierColumn) return [];
    return csv.result.rows
      .map((r) => r[identifierColumn] ?? "")
      .filter((v) => v.trim().length > 0)
      .slice(0, 3);
  }, [csv.result, identifierColumn]);

  const suggestedColumn = useMemo<{
    column: string;
    coverage: number;
  } | null>(() => {
    if (!csv.result || !identifierColumn) return null;
    const currentCoverage = computeCoverage(csv.result.rows, identifierColumn);
    let bestCol: string | null = null;
    let bestCoverage = currentCoverage;

    for (const header of csv.result.headers) {
      if (header === identifierColumn) continue;
      const cov = computeCoverage(csv.result.rows, header);
      if (cov > bestCoverage + 5) {
        bestCoverage = cov;
        bestCol = header;
      }
    }

    if (bestCol) {
      return { column: bestCol, coverage: bestCoverage };
    }
    return null;
  }, [csv.result, identifierColumn]);

  const handleSwitchToSuggested = useCallback(() => {
    if (suggestedColumn) {
      setIdentifierColumn(suggestedColumn.column);
    }
  }, [suggestedColumn]);

  const skippedFieldCount = useMemo(() => {
    if (!csv.result) return 0;
    const rows = csv.result.rows;
    const headers = csv.result.headers;
    if (rows.length === 0) return 0;

    let count = 0;
    for (const header of headers) {
      const filled = rows.filter(
        (r) => r[header] && r[header].trim().length > 0
      ).length;
      const cov = (filled / rows.length) * 100;
      if (cov > 80) count++;
    }
    return Math.max(0, count - 1);
  }, [csv.result]);

  const detectedFormat = useMemo<
    { format: string; confidence: number; matchedHeaders: string[] } | undefined
  >(() => {
    if (!csv.result) return undefined;
    const headers = csv.result.headers.map((h) => h.toLowerCase());

    const hubspotHints = [
      "record id",
      "company name",
      "company domain name",
      "create date",
      "hubspot owner",
      "lifecycle stage",
    ];
    const salesforceHints = [
      "account id",
      "account name",
      "billing city",
      "opportunity name",
      "stage",
    ];

    const hubspotMatches = hubspotHints.filter((hint) =>
      headers.some((h) => h.includes(hint))
    );
    const salesforceMatches = salesforceHints.filter((hint) =>
      headers.some((h) => h.includes(hint))
    );

    if (hubspotMatches.length >= 2) {
      return {
        format: "HubSpot Export",
        confidence: Math.min(hubspotMatches.length / hubspotHints.length, 1),
        matchedHeaders: hubspotMatches,
      };
    }
    if (salesforceMatches.length >= 2) {
      return {
        format: "Salesforce Export",
        confidence: Math.min(
          salesforceMatches.length / salesforceHints.length,
          1
        ),
        matchedHeaders: salesforceMatches,
      };
    }

    return undefined;
  }, [csv.result]);

  return (
    <div className="relative min-h-[100dvh] bg-[#0a1628]">
      {/* Ambient gradient — top-center blue cone like brightdata.com */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(40,80,160,0.22), transparent 70%), radial-gradient(ellipse 60% 40% at 50% 5%, rgba(60,120,200,0.10), transparent 60%), radial-gradient(ellipse 50% 50% at 30% 15%, rgba(30,60,140,0.07), transparent 50%), radial-gradient(ellipse 40% 45% at 70% 10%, rgba(25,55,130,0.06), transparent 50%)",
        }}
      />
      {/* Line grid — thin crossing lines forming squares */}
      <div
        className="pointer-events-none fixed inset-0"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,150,220,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(100,150,220,0.09) 1px, transparent 1px)",
          backgroundSize: "140px 140px",
        }}
      />

      <div className="relative z-10">
        <Header onSettingsClick={() => setSettingsOpen(true)} />

        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.main
              key="upload"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="mx-auto max-w-2xl px-6 pt-28 pb-32"
            >
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="visible"
                className="flex flex-col items-start gap-5"
              >
                <motion.span
                  variants={fadeUp}
                  className="px-3.5 py-1.5 bg-[rgba(75,139,255,0.06)] border border-[rgba(75,139,255,0.12)] rounded-lg text-[#4B8BFF] text-xs font-medium tracking-wide"
                >
                  AI-powered lead enrichment
                </motion.span>

                <motion.h1
                  variants={fadeUp}
                  className="text-[2.75rem] md:text-[3.5rem] font-extrabold text-[#f0f2f8] tracking-[-0.035em] leading-[1.05]"
                >
                  Enrich your leads
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  className="text-[rgba(240,242,248,0.45)] text-lg leading-relaxed max-w-md"
                >
                  Upload a CSV with email addresses. Our AI agents research each
                  company using Bright Data&#39;s web infrastructure.
                </motion.p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, ...spring }}
                className="mt-10"
              >
                <CSVUploader
                  onFileAccepted={handleFileAccepted}
                  parsedRows={csv.result?.rows}
                  parsedHeaders={csv.result?.headers}
                  error={csv.result?.error}
                  isParsing={csv.isParsing}
                />
              </motion.div>

              {csvReady && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={spring}
                  className="mt-8"
                >
                  <button
                    onClick={handleContinueToConfigure}
                    className="group relative px-7 py-3.5 bg-gradient-to-r from-[#A5A0F6] via-[#4B8BFF] to-[#22D3EE] text-white font-semibold rounded-xl shadow-[0_0_24px_rgba(75,139,255,0.2),0_0_48px_rgba(75,139,255,0.08)] hover:shadow-[0_0_32px_rgba(75,139,255,0.35),0_0_64px_rgba(75,139,255,0.12)] hover:translate-y-[-1px] active:translate-y-0 active:scale-[0.98] transition-all duration-250"
                  >
                    <span className="relative z-10">Continue to configure</span>
                    <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </button>
                </motion.div>
              )}
            </motion.main>
          )}

          {step === "configure" && (
            <motion.main
              key="configure"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="mx-auto max-w-4xl px-6 pt-28 pb-32"
            >
              <div className="flex items-center gap-4 mb-10">
                <button
                  onClick={handleBackToUpload}
                  className="p-2.5 rounded-xl text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200 active:scale-95"
                  aria-label="Back to upload"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="text-2xl font-bold text-[#f0f2f8] tracking-tight">
                  Configure enrichment
                </h1>
              </div>

              {csv.result && (
                <EnrichmentConfig
                  headers={csv.result.headers}
                  identifierColumn={identifierColumn}
                  identifierType={identifierType}
                  identifierConfidence={csv.result.identifierConfidence}
                  identifierCoverage={identifierCoverage}
                  identifierReasoning={csv.result.identifierReasoning}
                  isDetecting={csv.isDetecting}
                  onIdentifierColumnChange={handleIdentifierColumnChange}
                  selectedFields={fields.selectedFields}
                  toggleField={fields.toggleField}
                  selectCategory={
                    fields.selectCategory as (category: string) => void
                  }
                  clearCategory={
                    fields.clearCategory as (category: string) => void
                  }
                  getCategoryFields={
                    fields.getCategoryFields as (
                      category: string
                    ) => Array<{
                      name: string;
                      displayName: string;
                      description: string;
                    }>
                  }
                  isCategoryFullySelected={
                    fields.isCategoryFullySelected as (
                      category: string
                    ) => boolean
                  }
                  categories={fields.categories}
                  customFields={fields.customFields}
                  onAddCustomField={fields.addCustomField}
                  onRemoveCustomField={fields.removeCustomField}
                  bundles={fields.QUICK_START_BUNDLES ?? []}
                  selectBundle={fields.selectBundle ?? (() => {})}
                  isBundleSelected={fields.isBundleSelected ?? (() => false)}
                  totalRows={csv.result.rows.length}
                  totalIdentified={totalIdentified}
                  onStart={handleStartEnrichment}
                  isRunning={enrichment.isRunning}
                  sampleValues={sampleValues}
                  detectedFormat={detectedFormat}
                  suggestedColumn={suggestedColumn}
                  onSwitchToSuggested={handleSwitchToSuggested}
                  skippedFieldCount={skippedFieldCount}
                />
              )}
            </motion.main>
          )}

          {step === "results" && (
            <motion.main
              key="results"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={spring}
              className="mx-auto max-w-7xl px-6 pt-28 pb-32"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleBackToConfigure}
                    className="p-2.5 rounded-xl text-[rgba(240,242,248,0.35)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] transition-all duration-200 active:scale-95"
                    aria-label="Back to configure"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-2xl font-bold text-[#f0f2f8] tracking-tight">
                    Enrichment results
                  </h1>
                </div>
                <div className="flex items-center gap-3">
                  {enrichmentReport && (
                    <button
                      onClick={() => setReportOpen(true)}
                      className="px-3.5 py-2 text-sm text-[rgba(240,242,248,0.45)] hover:text-[#f0f2f8] hover:bg-[rgba(165,180,220,0.06)] rounded-xl transition-all duration-200 inline-flex items-center gap-2"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Report
                    </button>
                  )}
                  <ExportControls
                    results={enrichment.results}
                    originalHeaders={csv.result?.headers ?? []}
                    enrichmentFieldNames={fields.allFields.map((f) => f.name)}
                  />
                </div>
              </div>

              {outboundClassification && (
                <OutboundSummaryCards
                  counts={outboundClassification.counts}
                  activeSegment={tableFilters.filters.segment}
                  onSegmentClick={(seg) => tableFilters.setFilter("segment", seg)}
                />
              )}

              {isComplete && (
                <div className="mt-5">
                  <FilterBar
                    filters={tableFilters.filters}
                    counts={filterCounts}
                    totalShowing={filteredResults.length}
                    totalRows={enrichment.results.length}
                    onFilterChange={tableFilters.setFilter}
                    onClearAll={tableFilters.clearAll}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 mt-6">
                <div className="lg:sticky lg:top-24 lg:self-start">
                  <EmailNotificationToggle
                    enabled={emailNotifyEnabled}
                    onToggle={setEmailNotifyEnabled}
                    email={emailNotifyAddress}
                    onEmailChange={setEmailNotifyAddress}
                    onOpenSettings={() => setSettingsOpen(true)}
                    isConfigured={emailConfigured}
                  />
                  {emailNotifyError && (
                    <div className="rounded-xl border border-[rgba(248,113,113,0.15)] bg-[rgba(248,113,113,0.06)] backdrop-blur-sm mb-4 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-[#F87171]">{emailNotifyError}</span>
                      <button
                        onClick={() => setEmailNotifyError(null)}
                        className="text-[rgba(248,113,113,0.5)] hover:text-[#F87171] transition-colors ml-2"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  <CostTicker
                    totalCost={enrichment.totalCost}
                    results={enrichment.results}
                    isRunning={enrichment.isRunning}
                  />
                  <EnrichmentProgress
                    completed={enrichment.progress.completed}
                    total={enrichment.progress.total}
                    isRunning={enrichment.isRunning}
                    agentLogs={enrichment.agentLogs}
                    onCancel={enrichment.cancel}
                  />
                </div>

                <div className="flex flex-col gap-6">
                  <EnrichmentTable
                    results={filteredResults}
                    originalHeaders={csv.result?.headers ?? []}
                    enrichmentFieldNames={fields.allFields.map((f) => f.name)}
                    isComplete={isComplete}
                  />
                </div>
              </div>

              {enrichmentReport && (
                <EnrichmentReportPanel
                  report={enrichmentReport}
                  open={reportOpen}
                  onClose={() => setReportOpen(false)}
                />
              )}
            </motion.main>
          )}
        </AnimatePresence>
      </div>
      {enrichment.demoModal.open ? (
        enrichment.demoModal.mode === "partial" ? (
          <DemoLimitModal
            open
            mode="partial"
            granted={enrichment.demoModal.granted}
            requested={enrichment.demoModal.requested}
            onClose={enrichment.closeDemoModal}
          />
        ) : (
          <DemoLimitModal open mode="blocked" onClose={enrichment.closeDemoModal} />
        )
      ) : null}
      <MCPSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
