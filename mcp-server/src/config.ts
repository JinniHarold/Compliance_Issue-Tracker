import { z } from "zod";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch (error) {
  if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
    console.error("Unable to load mcp-server/.env.");
    process.exit(1);
  }
}

const configSchema = z.object({
  API_BASE_URL: z
    .string()
    .url()
    .refine((value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    }),
  AGENT_TOKEN: z.string().regex(/^agt_[0-9a-f]{64}$/),
});

const parsedConfig = configSchema.safeParse(process.env);

if (!parsedConfig.success) {
  const invalidVariables = new Set(parsedConfig.error.issues.map((issue) => issue.path[0]));
  if (invalidVariables.has("API_BASE_URL")) {
    console.error("Invalid API_BASE_URL: expected an http or https URL.");
  }
  if (invalidVariables.has("AGENT_TOKEN")) {
    console.error("Invalid AGENT_TOKEN: expected a token in the format agt_ followed by 64 lowercase hexadecimal characters.");
  }
  process.exit(1);
}

export const config = {
  apiBaseUrl: parsedConfig.data.API_BASE_URL,
  agentToken: parsedConfig.data.AGENT_TOKEN,
};
