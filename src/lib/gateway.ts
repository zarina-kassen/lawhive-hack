import { createAnthropic } from "@ai-sdk/anthropic";

const GATEWAY_BASE_URL = "https://ai.hack.lawhive.co.uk/v1";
const OPUS_MODEL_ID = "vertex_ai/claude-opus-4-7";

const AUTH_TOKEN_ENV_NAMES = [
  "LAWHIVE_AI_AUTH_TOKEN",
  "LAWHIVE_AI_GATEWAY_AUTH_TOKEN",
  "AI_GATEWAY_AUTH_TOKEN",
  "AI_GATEWAY_API_KEY",
  "LAWHIVE_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_API_KEY",
  "AUTH_TOKEN",
];

function getAuthToken(): string {
  for (const name of AUTH_TOKEN_ENV_NAMES) {
    const value = process.env[name]?.trim();

    if (value) {
      return value;
    }
  }

  throw new Error(
    `Missing Lawhive AI gateway token. Set one of: ${AUTH_TOKEN_ENV_NAMES.map((name) => name).join(", ")}.`,
  );
}

export function getOpusModel() {
  const provider = createAnthropic({
    baseURL: GATEWAY_BASE_URL,
    authToken: getAuthToken(),
  });

  return provider(OPUS_MODEL_ID);
}
