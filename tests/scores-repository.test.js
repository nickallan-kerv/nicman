import { describe, it, expect, vi } from "vitest";
import { createScoresRepository } from "../src/scores-repository.js";

describe("scores repository", () => {
  const config = {
    supabaseUrl: "https://example.supabase.co",
    publishableKey: "test-publishable-key"
  };

  it("loads the top scores with the expected query and API key", async () => {
    const rows = [{ player_name: "PLAYER1", score: 120, level: 2 }];
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rows
    });
    const repository = createScoresRepository({ ...config, fetchImpl });

    await expect(repository.listTop(10)).resolves.toEqual(rows);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url.toString()).toBe(
      "https://example.supabase.co/rest/v1/scores?select=player_name%2Cscore%2Clevel%2Ccreated_at&order=score.desc%2Ccreated_at.asc&limit=10"
    );
    expect(options.method).toBe("GET");
    expect(options.headers).toEqual({ apikey: "test-publishable-key" });
  });

  it("inserts a score as JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
    const repository = createScoresRepository({ ...config, fetchImpl });
    const score = { player_name: "PLAYER1", score: 120, level: 2 };

    await repository.addScore(score);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url.toString()).toBe("https://example.supabase.co/rest/v1/scores");
    expect(options.method).toBe("POST");
    expect(options.headers).toEqual({
      apikey: "test-publishable-key",
      "Content-Type": "application/json"
    });
    expect(options.body).toBe(JSON.stringify(score));
  });

  it("surfaces Supabase request errors", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "row-level security policy violation"
    });
    const repository = createScoresRepository({ ...config, fetchImpl });

    await expect(repository.listTop()).rejects.toThrow(
      "Request failed (403): row-level security policy violation"
    );
  });
});