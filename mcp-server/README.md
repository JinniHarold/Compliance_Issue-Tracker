# Compliance Tracker MCP server

## Setup

Run `npm install` in `mcp-server/`, copy `.env.example` to `.env`, then run `npm run agent:token` in `backend/` and paste the token into `mcp-server/.env`.

## Inspector

Run `npm run inspect` in `mcp-server/`.

## Claude Desktop

```json
{
  "mcpServers": {
    "compliance-tracker": {
      "command": "npx",
      "args": ["tsx", "<absolute path>/mcp-server/src/index.ts"]
    }
  }
}
```
