import Anthropic from "@anthropic-ai/sdk";

export const NOVA_MODEL = "claude-opus-5-5";

let client: Anthropic | undefined;

/** Reads ANTHROPIC_API_KEY from the environment (.env.local in development). */
export function getAnthropicClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export function hasApiCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
