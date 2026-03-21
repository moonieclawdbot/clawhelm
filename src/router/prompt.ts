const METADATA_FENCE_RE = /^([\t ]*[^\n]*\(untrusted metadata\):\n```[a-zA-Z0-9_-]*\n[\s\S]*?\n```\s*\n?)+/i;

/**
 * Extract the real user-authored prompt from OpenClaw transport wrappers.
 *
 * before_model_resolve runs before session load, so only the raw prompt string is available.
 * On some channels OpenClaw prepends one or more `(untrusted metadata)` fenced JSON blocks.
 * Those blocks should not influence routing. This extractor removes only the known metadata
 * wrapper prefix and leaves the actual user prompt intact.
 */
export function extractUserPrompt(rawPrompt: string): string {
  const trimmed = rawPrompt.trimStart();
  const withoutMetadata = trimmed.replace(METADATA_FENCE_RE, "").trimStart();
  return withoutMetadata || trimmed;
}
