import { Command } from "commander";
import { runLogin } from "./commands/login";
import { runLogout } from "./commands/logout";

const program = new Command();
program
  .name("enrich")
  .description("Enrich CSVs with company and person data using Bright Data + LLM agents")
  .version("0.1.0");

program
  .argument("[input.csv]", "Input CSV file")
  .option("-o, --output <path>", "Output CSV path (default: <input>.enriched.csv)")
  .option("--column <name>", "Identifier column (auto-detected if omitted)")
  .option("--first-name <name>", "Column containing person's first name")
  .option("--last-name <name>", "Column containing person's last name")
  .option("--concurrency <n>", "Rows in flight at once", "30")
  .option("--describe <text>", "Natural-language field description")
  .option("--fields <names>", "Comma-separated preset field names")
  .option("--no-resume", "Overwrite output if it exists; do not auto-resume")
  .option("--dry-run", "Resolve config and exit without making API calls")
  .option("--json", "Stream NDJSON events to stdout; do not write CSV")
  .option("-q, --quiet", "Suppress progress; only final summary")
  .option("-v, --verbose", "Show every agent_progress event")
  .action(async (input: string | undefined, opts) => {
    if (!input) {
      program.help();
      return;
    }
    // Lazy-load heavy enrich command
    const { runEnrichCommand } = await import("./commands/enrich");
    const code = await runEnrichCommand(input, {
      output: opts.output,
      column: opts.column,
      firstName: opts.firstName,
      lastName: opts.lastName,
      concurrency: opts.concurrency,
      describe: opts.describe,
      fields: opts.fields,
      resume: opts.resume !== false,
      dryRun: opts.dryRun === true,
      json: opts.json === true,
      quiet: opts.quiet === true,
      verbose: opts.verbose === true,
    });
    process.exit(code);
  });

program
  .command("login")
  .description("Interactively configure credentials")
  .action(async () => { await runLogin(); });

program
  .command("logout")
  .description("Remove stored credentials")
  .action(async () => { await runLogout(); });

program.parseAsync();
