import { describe, expect, it, vi } from "vitest";
import type { Section } from "./content";
import { fuseRankings, keywordQuery, retrieve, type SearchBackend } from "./retrieval";

const chunk = (id: string): Section => ({
  id,
  file: `${id.split("#")[0]}.md`,
  pageTitle: id,
  heading: id,
  url: `/${id}`,
  text: `text of ${id}`,
});

function fakeBackend(vectorIds: string[], textIds: string[]): SearchBackend {
  return {
    embedQuery: vi.fn(async () => [0.1, 0.2]),
    vectorSearch: vi.fn(async () => vectorIds.map(chunk)),
    textSearch: vi.fn(async () => textIds.map(chunk)),
  };
}

describe("fuseRankings", () => {
  it("ranks an id found by both searches above ids found by one", () => {
    expect(fuseRankings([["a", "b", "c"], ["c", "d"]])[0]).toBe("c");
  });

  it("keeps ids that only one search found", () => {
    expect(fuseRankings([["a"], ["b"]]).sort()).toEqual(["a", "b"]);
  });

  it("breaks ties in favour of the first (vector) ranking", () => {
    expect(fuseRankings([["a"], ["b"]])).toEqual(["a", "b"]);
  });

  it("uses rank, not position in the combined list", () => {
    // "z" is 1st in text search; "y" is 2nd in vector search. 1/61 > 1/62.
    expect(fuseRankings([["x", "y"], ["z"]])).toEqual(["x", "z", "y"]);
  });
});

describe("retrieve", () => {
  it("returns the top k chunks of the fused ranking", async () => {
    const backend = fakeBackend(["a", "b", "c", "d"], ["d", "e"]);

    const result = await retrieve("Has he used PySpark?", backend, 3);

    expect(result.map((c) => c.id)).toEqual(["d", "a", "b"]);
    expect(result[0]).toEqual(chunk("d"));
  });

  it("surfaces an exact-term match that vector search missed", async () => {
    const backend = fakeBackend(["cv#summary", "cv#education"], ["projects/pipeline#stack"]);

    const ids = (await retrieve("PySpark", backend, 2)).map((c) => c.id);

    expect(ids).toContain("projects/pipeline#stack");
  });

  it("embeds the whole question and full-text searches only its keywords", async () => {
    const backend = fakeBackend(["a"], []);

    await retrieve("Has Alexander used PySpark?", backend);

    expect(backend.embedQuery).toHaveBeenCalledWith("Has Alexander used PySpark?");
    expect(backend.vectorSearch).toHaveBeenCalledWith([0.1, 0.2], expect.any(Number));
    expect(backend.textSearch).toHaveBeenCalledWith("PySpark", expect.any(Number));
  });

  it("skips full-text search when the question has no keywords", async () => {
    const backend = fakeBackend(["a"], []);

    await retrieve("Where is Alexander based?", backend);

    expect(backend.textSearch).not.toHaveBeenCalled();
  });

  it("returns an empty list when nothing is stored", async () => {
    expect(await retrieve("anything", fakeBackend([], []))).toEqual([]);
  });

  it("propagates search failures so the caller can fall back", async () => {
    const backend = fakeBackend([], []);
    backend.textSearch = vi.fn(async () => {
      throw new Error("database down");
    });

    await expect(retrieve("Has he used PySpark?", backend)).rejects.toThrow("database down");
  });
});

describe("keywordQuery", () => {
  it.each([
    ["Has Alexander used PySpark?", "PySpark"],
    ["Has Alexander set up CI/CD pipelines?", "CI/CD"],
    ["What experience does Alexander have with C#?", "C#"],
    ["What tech stack does RepTracker use?", "RepTracker"],
    ["What did Alexander do at the University of Copenhagen?", "University Copenhagen"],
    ["Is Alexander's GPA above 9?", "GPA 9"],
    ["Has he worked with .NET 10?", "NET 10"],
  ])("keeps names and technical terms: %s", (query, expected) => {
    expect(keywordQuery(query)).toBe(expected);
  });

  it.each(["Where is Alexander based?", "Is Alexander open to relocation?", "When can he start?"])(
    "returns nothing for questions made of common words: %s",
    (query) => {
      expect(keywordQuery(query)).toBe("");
    },
  );
});
