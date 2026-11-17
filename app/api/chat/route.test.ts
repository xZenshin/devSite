import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES } from "@/lib/config";
import { POST } from "./route";

const question = JSON.stringify({ messages: [{ role: "user", parts: [{ type: "text", text: "Hi" }] }] });

function post(body: string, headers: Record<string, string> = { "content-type": "application/json" }) {
  return POST(new Request("http://localhost/api/chat", { method: "POST", headers, body }));
}

// Each of these is turned away before anything that costs money (retrieval, the model, the rate limit).
describe("POST /api/chat", () => {
  it("only accepts JSON, which another site's page can't send without a preflight", async () => {
    expect((await post(question, { "content-type": "text/plain" })).status).toBe(415);
    expect((await post(question, { "content-type": "application/x-www-form-urlencoded" })).status).toBe(415);
  });

  it("turns away requests a browser marks as cross-site", async () => {
    const response = await post(question, { "content-type": "application/json", "sec-fetch-site": "cross-site" });
    expect(response.status).toBe(403);
  });

  it("stops reading a body over the limit", async () => {
    const big = JSON.stringify({ messages: [{ role: "user", parts: [{ type: "text", text: "x".repeat(MAX_BODY_BYTES) }] }] });
    expect((await post(big)).status).toBe(413);
  });

  it("rejects bodies that aren't a conversation", async () => {
    expect((await post("not json")).status).toBe(400);
    expect((await post(JSON.stringify({ messages: [] }))).status).toBe(400);
  });
});
