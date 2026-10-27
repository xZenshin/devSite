import { describe, expect, it } from "vitest";
import type { Chunk } from "./chunking";
import { planSync } from "./sync";

const chunk = (id: string, hash: string) => ({ id, hash }) as Chunk;

describe("planSync", () => {
  it("upserts new and changed chunks, deletes removed ones, skips unchanged ones", () => {
    const plan = planSync(
      [chunk("same", "h1"), chunk("changed", "new-hash"), chunk("new", "h3")],
      new Map([
        ["same", "h1"],
        ["changed", "old-hash"],
        ["removed", "h4"],
      ]),
    );

    expect(plan.upsert.map((c) => c.id)).toEqual(["changed", "new"]);
    expect(plan.unchanged).toBe(1);
    expect(plan.deleteIds).toEqual(["removed"]);
  });

  it("does nothing when the database already matches (idempotent re-run)", () => {
    const chunks = [chunk("a", "h1"), chunk("b", "h2")];
    const stored = new Map(chunks.map((c) => [c.id, c.hash]));

    expect(planSync(chunks, stored)).toEqual({ upsert: [], unchanged: 2, deleteIds: [] });
  });
});
