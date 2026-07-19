import Anthropic from "@anthropic-ai/sdk";

/** Client Claude — serveur uniquement. Ne jamais importer côté client. */
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5";
