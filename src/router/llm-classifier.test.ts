import { describe, expect, it, vi } from "vitest";

import { classifyByLLM } from "./llm-classifier.js";

const config = {
  model: "openai/gpt-4o-mini",
  maxTokens: 10,
  temperature: 0,
  truncationChars: 500,
  cacheTtlMs: 60_000,
};

describe("classifyByLLM", () => {
  it("parses classifier response content into a tier", async () => {
    const payFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "The best tier is REASONING" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await classifyByLLM(
      "Prove this theorem in detail",
      config,
      payFetch,
      "https://api.example.com",
    );

    expect(result.tier).toBe("REASONING");
    expect(result.confidence).toBe(0.75);
    expect(payFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to MEDIUM when response is non-OK", async () => {
    const payFetch = vi.fn(async () => new Response("oops", { status: 500 }));

    const result = await classifyByLLM(
      "Classify me",
      config,
      payFetch,
      "https://api.example.com",
    );

    expect(result).toEqual({ tier: "MEDIUM", confidence: 0.5 });
  });

  it("uses cache for repeated prompts", async () => {
    const payFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "SIMPLE" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const prompt = "Cache check prompt";
    const first = await classifyByLLM(prompt, config, payFetch, "https://api.example.com");
    const second = await classifyByLLM(prompt, config, payFetch, "https://api.example.com");

    expect(first.tier).toBe("SIMPLE");
    expect(second.tier).toBe("SIMPLE");
    expect(payFetch).toHaveBeenCalledTimes(1);
  });
});
