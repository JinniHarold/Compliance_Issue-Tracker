import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolResult, Tools } from "./run.js";

/**
 * Starts the MCP server as a child process and talks to it over stdio.
 * The playbook never sees the agent token: the server reads it from mcp-server/.env.
 */
export async function connectTools(): Promise<{ tools: Tools; close: () => Promise<void> }> {
  const dir = process.env.MCP_SERVER_DIR
    ? path.resolve(process.env.MCP_SERVER_DIR)
    : fileURLToPath(new URL("../../mcp-server", import.meta.url));

  const transport = new StdioClientTransport({
    command: process.execPath, // node
    args: ["--import", "tsx", "src/index.ts"],
    cwd: dir,
    stderr: "inherit", // server log lines show up in this terminal
  });
  const client = new Client({ name: "compliance-playbook", version: "1.0.0" });
  await client.connect(transport);

  const tools: Tools = {
    async call(name, args): Promise<ToolResult> {
      try {
        const res = await client.callTool({ name, arguments: args });
        const items = (Array.isArray(res.content) ? res.content : []) as { type: string; text?: string }[];
        const texts = items.filter((i) => i.type === "text" && typeof i.text === "string").map((i) => i.text as string);
        if (res.isError) return { ok: false, error: texts.join(" ").slice(0, 300) || "tool returned an error" };
        for (const t of texts) {
          try {
            return { ok: true, data: JSON.parse(t) };
          } catch {
            /* try the next text item */
          }
        }
        return { ok: false, error: "tool returned no JSON" };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
  return { tools, close: () => client.close() };
}
