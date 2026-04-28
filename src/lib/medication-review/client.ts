import "server-only";
import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

/** Returns the Anthropic client, or null if no API key is configured. */
export function getAnthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}
