import { describe, expect, it } from "vitest";

import { extractUserPrompt } from "./prompt.js";

describe("extractUserPrompt", () => {
  it("returns the raw prompt when no metadata wrapper is present", () => {
    const prompt = "Translate to Italian: 'I will be there in 10 minutes.'";
    expect(extractUserPrompt(prompt)).toBe(prompt);
  });

  it("removes leading untrusted metadata blocks and keeps the real user prompt", () => {
    const wrapped = `Conversation info (untrusted metadata):
\`\`\`json
{"message_id":"1"}
\`\`\`

Sender (untrusted metadata):
\`\`\`json
{"name":"Alessandro"}
\`\`\`

What is the capital of Italy? Answer with one word.`;

    expect(extractUserPrompt(wrapped)).toBe("What is the capital of Italy? Answer with one word.");
  });

  it("keeps text unchanged when metadata-like text appears later in the prompt body", () => {
    const prompt = `Please explain this literal string:
Conversation info (untrusted metadata): not actually metadata.`;
    expect(extractUserPrompt(prompt)).toBe(prompt);
  });
});
