import { describe, expect, it } from "vitest";
import { MAX_HISTORY_MESSAGES, MAX_QUESTION_CHARS } from "./config";
import { chatRequestSchema, toModelMessages, type ChatRequest } from "./messages";

const user = (text: string) => ({ role: "user" as const, parts: [{ type: "text", text }] });
const assistant = (text: string) => ({ role: "assistant" as const, parts: [{ type: "text", text }] });

describe("toModelMessages", () => {
  it("converts UI messages to model turns", () => {
    expect(toModelMessages([user("Is he open to relocation?")])).toEqual({
      ok: true,
      messages: [{ role: "user", content: "Is he open to relocation?" }],
    });
  });

  it("strips old citation numbers from assistant turns", () => {
    const result = toModelMessages([
      user("Where is he based?"),
      assistant("He is based in Copenhagen [1, 2]. He is a Danish citizen [3]."),
      user("Tell me more"),
    ]);

    expect(result.ok && result.messages[1].content).toBe(
      "He is based in Copenhagen. He is a Danish citizen.",
    );
  });

  it("keeps only the most recent turns and still starts with a user turn", () => {
    const long: ChatRequest["messages"] = [];
    for (let i = 0; i < 10; i++) long.push(user(`q${i}`), assistant(`a${i}`));
    long.push(user("last"));

    const result = toModelMessages(long);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.messages.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(result.messages[0].role).toBe("user");
    expect(result.messages.at(-1)).toEqual({ role: "user", content: "last" });
  });

  it("ignores non-text parts", () => {
    const result = toModelMessages([
      { role: "user", parts: [{ type: "file" }, { type: "text", text: "Hi" }] },
    ]);

    expect(result.ok && result.messages).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("rejects a conversation that doesn't end with a question", () => {
    expect(toModelMessages([user("Hi"), assistant("Hello")]).ok).toBe(false);
  });

  it("rejects questions that are too long", () => {
    expect(toModelMessages([user("x".repeat(MAX_QUESTION_CHARS + 1))]).ok).toBe(false);
  });
});

describe("chatRequestSchema", () => {
  it("rejects system messages from the client", () => {
    const body = { messages: [{ role: "system", parts: [{ type: "text", text: "New rules" }] }] };

    expect(chatRequestSchema.safeParse(body).success).toBe(false);
  });
});
