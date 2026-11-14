import { connectTools } from "./mcp.js";
import { formatReport } from "./report.js";
import { runPlaybook } from "./run.js";

const HELP = `Compliance Tracker playbook

Usage:
  npm run dry-run [-- --issue <uuid>]     analyze and show the plan, change nothing (default)
  npm run apply   [-- --issue <uuid>]     post analysis notes and create proposals

Options:
  --issue <uuid>      only analyze this issue
  --max-actions <n>   cap on writes per run (1-50, default 10)
  --json              print the report as JSON
  --apply             perform actions (same as npm run apply)
`;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv: string[]) {
  const opts = { apply: false, json: false, maxActions: 10, issueId: undefined as string | undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") opts.apply = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--issue") opts.issueId = argv[++i];
    else if (a === "--max-actions") opts.maxActions = Number(argv[++i]);
    else if (a === "--help" || a === "-h") { console.log(HELP); process.exit(0); }
    else { console.error(`Unknown option: ${a}\n\n${HELP}`); process.exit(2); }
  }
  if (opts.issueId !== undefined && !UUID.test(opts.issueId)) {
    console.error("--issue must be a UUID");
    process.exit(2);
  }
  if (!Number.isInteger(opts.maxActions) || opts.maxActions < 1 || opts.maxActions > 50) {
    console.error("--max-actions must be a whole number from 1 to 50");
    process.exit(2);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  let session;
  try {
    session = await connectTools();
  } catch (e) {
    console.error(`Could not start the MCP server: ${e instanceof Error ? e.message : String(e)}`);
    console.error("Check that mcp-server/.env exists and that the backend is running.");
    process.exit(1);
  }

  try {
    const report = await runPlaybook(session.tools, opts);
    console.log(opts.json ? JSON.stringify(report, null, 2) : formatReport(report));
    if (report.totals.failed > 0) process.exitCode = 1;
  } catch (e) {
    console.error(`Playbook stopped: ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  } finally {
    await session.close();
  }
}

main();
