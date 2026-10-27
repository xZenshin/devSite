import { describe, expect, it } from "vitest";
import { extractCitations, splitCitations } from "./citations";

describe("extractCitations", () => {
  it("returns cited numbers in order of first appearance", () => {
    expect(extractCitations("Yes [2]. Also [1][2] and [3, 1].", 3)).toEqual([2, 1, 3]);
  });

  it("ignores numbers that are not valid source ids", () => {
    expect(extractCitations("See [0], [4] and [2].", 3)).toEqual([2]);
  });

  it("returns nothing when the answer cites no sources", () => {
    expect(extractCitations("I don't have that information.", 3)).toEqual([]);
  });
});

describe("splitCitations", () => {
  it("splits text around citation markers", () => {
    expect(splitCitations("Based in Copenhagen [1]. Danish citizen [2, 3].")).toEqual([
      { type: "text", text: "Based in Copenhagen " },
      { type: "citation", numbers: [1] },
      { type: "text", text: ". Danish citizen " },
      { type: "citation", numbers: [2, 3] },
      { type: "text", text: "." },
    ]);
  });

  it("returns a single text segment when there are no markers", () => {
    expect(splitCitations("No sources here.")).toEqual([{ type: "text", text: "No sources here." }]);
  });

  it("leaves non-numeric brackets as text", () => {
    expect(splitCitations("See [the CV]")).toEqual([{ type: "text", text: "See [the CV]" }]);
  });
});
