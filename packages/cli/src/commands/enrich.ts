import { readFile } from "fs/promises";
import pc from "picocolors";
import type {
  EnrichmentField,
  RunEnrichmentEvent,
} from "@brightdata/enrich-core";
import { resolveCredentials, hasAllCredentials, formatMissingCredentialsError } from "../auth/resolve";
import { resolveFields, UnknownFieldsError } from "../fields/resolve";
import { ProgressRenderer } from "../io/progress";
import { OrderedCSVWriter, inspectExistingOutput, buildHeader } from "../io/output";

export interface EnrichOptions {
  output?: string;
  column?: string;
  firstName?: string;
  lastName?: string;
  concurrency?: string;
  describe?: string;
  fields?: string;
  resume: boolean;
  dryRun: boolean;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
}

export async function runEnrichCommand(inputPath: string, opts: EnrichOptions): Promise<number> {
  if (!opts.describe && !opts.fields) {
    console.error(pc.red("Error: specify --describe \"...\" or --fields a,b,c"));
    return 2;
  }
  if (opts.describe && opts.fields) {
    console.error(pc.red("Error: --describe and --fields are mutually exclusive"));
    return 2;
  }

  // Resolve credentials
  const resolved = await resolveCredentials();
  if (!hasAllCredentials(resolved)) {
    console.error(formatMissingCredentialsError(resolved));
    return 2;
  }

  // Read + parse input
  let csvText: string;
  try { csvText = await readFile(inputPath, "utf-8"); }
  catch (err) {
    console.error(pc.red(`Error: could not read ${inputPath}: ${err instanceof Error ? err.message : err}`));
    return 1;
  }

  // Lazy-load heavy engine modules
  const { parseCSV, detectIdentifierColumn, runEnrichment, PRESET_FIELDS } = await import("@brightdata/enrich-core");

  const parsed = parseCSV(csvText);
  if (parsed.rows.length === 0) {
    console.error(pc.red("Error: input CSV has no rows"));
    return 1;
  }

  // Resolve identifier column
  let identifierColumn = opts.column;
  if (!identifierColumn) {
    const detection = await detectIdentifierColumn(parsed.rows, {
      credentials: resolved.credentials,
      useLLMFallback: true,
    });
    if (!detection.column) {
      console.error(pc.red("Error: could not auto-detect identifier column. Pass --column <name>."));
      return 1;
    }
    identifierColumn = detection.column;
    if (!opts.quiet) {
      process.stderr.write(pc.dim(`Identifier column: ${identifierColumn} (auto-detected, confidence ${detection.confidence.toFixed(2)})\n`));
    }
  }

  // Resolve fields
  let fields: EnrichmentField[];
  let fieldSource: string;
  try {
    const r = await resolveFields({ describe: opts.describe, fields: opts.fields }, resolved.credentials);
    fields = r.fields;
    fieldSource = r.source;
  } catch (err) {
    if (err instanceof UnknownFieldsError) {
      console.error(pc.red(`Error: unknown field names: ${err.unknown.join(", ")}`));
      console.error(pc.dim(`Valid names: ${PRESET_FIELDS.map((f) => f.name).join(", ")}`));
      return 2;
    }
    throw err;
  }
  if (fields.length === 0) {
    console.error(pc.red("Error: no fields resolved from your description"));
    return 1;
  }

  // Determine output path
  const outputPath = opts.output ?? `${inputPath.replace(/\.csv$/i, "")}.enriched.csv`;

  // Dry run
  if (opts.dryRun) {
    console.log("");
    console.log(`Input:        ${inputPath} (${parsed.rows.length} rows, ${parsed.headers.length} columns)`);
    console.log(`Identifier:   ${identifierColumn}`);
    console.log(`Fields:       ${fields.map((f) => f.name).join(", ")}`);
    console.log(`              (source: ${fieldSource})`);
    console.log(`Concurrency:  ${opts.concurrency ?? 30}`);
    console.log(`Output:       ${outputPath}`);
    const estTool = parsed.rows.length * 6 * 0.0015;
    const estLLM = parsed.rows.length * 0.002;
    console.log(`Estimated:    ~$${estTool.toFixed(2)} (Bright Data) + ~$${estLLM.toFixed(2)} (LLM) = $${(estTool + estLLM).toFixed(2)} total`);
    return 0;
  }

  // Resume detection
  const enrichmentFieldNames = fields.map((f) => f.name);
  let startAt = 0;
  let appendMode = false;
  if (opts.resume) {
    const expectedHeader = buildHeader(parsed.headers, enrichmentFieldNames);
    const info = inspectExistingOutput(outputPath, expectedHeader);
    if (info.exists) {
      if (!info.resumable) {
        console.error(pc.red(`Error: ${outputPath} exists with incompatible columns.\n${info.reason}\nPass --no-resume to overwrite, or pick a different output path.`));
        return 1;
      }
      startAt = info.completedRows;
      appendMode = true;
      if (!opts.quiet) {
        process.stderr.write(pc.dim(`Resuming from row ${startAt} (${info.completedRows} rows already in ${outputPath})\n`));
      }
    }
  }

  // Open writer
  const writer = new OrderedCSVWriter(outputPath, parsed.headers, enrichmentFieldNames, { append: appendMode, startAt });

  // Run engine
  const rowsToProcess = parsed.rows.slice(startAt);
  const progress = new ProgressRenderer({
    total: parsed.rows.length,
    quiet: opts.quiet,
    verbose: opts.verbose,
    outputPath,
  });

  for (let i = 0; i < rowsToProcess.length; i++) {
    progress.setRowIdentifier(startAt + i, rowsToProcess[i][identifierColumn] ?? `row ${startAt + i}`);
  }

  const controller = new AbortController();
  const sigintHandler = () => {
    controller.abort();
    process.once("SIGINT", () => {
      process.stderr.write("\nForce-exit on second Ctrl-C.\n");
      process.exit(130);
    });
  };
  process.on("SIGINT", sigintHandler);

  let exitCode = 0;
  try {
    for await (const event of runEnrichment({
      rows: rowsToProcess,
      fields,
      identifierColumn,
      firstNameColumn: opts.firstName,
      lastNameColumn: opts.lastName,
      credentials: resolved.credentials,
      concurrency: opts.concurrency ? Number(opts.concurrency) : 30,
      signal: controller.signal,
    })) {
      const adjustedEvent = adjustRowIndex(event, startAt);
      if (opts.json) {
        process.stdout.write(JSON.stringify(adjustedEvent) + "\n");
      } else {
        progress.handleEvent(adjustedEvent);
        if (adjustedEvent.type === "result") writer.acceptResult(adjustedEvent.result);
      }
    }
  } catch (err) {
    console.error(pc.red(`\nError during enrichment: ${err instanceof Error ? err.message : err}`));
    exitCode = 1;
  } finally {
    process.off("SIGINT", sigintHandler);
    await writer.close();
    if (controller.signal.aborted) exitCode = 130;
  }
  return exitCode;
}

function adjustRowIndex(event: RunEnrichmentEvent, offset: number): RunEnrichmentEvent {
  switch (event.type) {
    case "pending":
    case "processing":
    case "agent_progress":
    case "cost_update":
    case "error":
      return { ...event, rowIndex: event.rowIndex + offset };
    case "result":
      return { ...event, result: { ...event.result, rowIndex: event.result.rowIndex + offset } };
    default:
      return event;
  }
}
