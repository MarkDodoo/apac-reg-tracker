import assert from "node:assert/strict";
import test from "node:test";

const security = await import("../src/server/ask-security.ts");

test("agent config fails closed and requires an explicit production host", () => {
  assert.equal(security.askAgentEnabled({}), false);
  assert.equal(
    security.askAgentEnabled({ LAWPLAIN_ASK_AGENT_ENABLED: "true" }),
    true,
  );
  assert.equal(
    security.askAgentEnabled({
      LAWPLAIN_ASK_AGENT_ENABLED: "true",
      NODE_ENV: "production",
    }),
    false,
  );
  assert.equal(
    security.askAgentEnabled({
      LAWPLAIN_ASK_AGENT_ENABLED: "true",
      NODE_ENV: "production",
      LAWPLAIN_PUBLIC_HOST: "lawplain.example",
    }),
    true,
  );
});

test("run names bind durable objects to the authenticated user", () => {
  assert.notEqual(
    security.userRunName("user-a", "same"),
    security.userRunName("user-b", "same"),
  );
});

test("redaction removes configured and recognizable credentials", () => {
  const secret = "super-secret-value";
  const result = security.redactSecrets(`token=${secret} sk-abcdefghijkl`, [
    secret,
  ]);
  assert.equal(result.includes(secret), false);
  assert.equal(result.includes("sk-abcdefghijkl"), false);
});

test("text bounds report truncation without exceeding tiny UTF-8 byte limits", () => {
  assert.deepEqual(security.boundedText("🙂🙂", 4), {
    text: "🙂",
    truncated: true,
  });
  assert.deepEqual(security.boundedText("🙂", 1), {
    text: "",
    truncated: true,
  });
  assert.equal(Buffer.byteLength(security.boundedText("é🙂", 3).text), 2);
});

test("only one explicitly selected provider credential is forwarded", () => {
  assert.deepEqual(
    security.providerCredential({
      CODEGRAFF_API_KEY: "needed",
      OPENAI_API_KEY: "unused",
    }),
    { CODEGRAFF_API_KEY: "needed" },
  );
  assert.equal(
    security.providerCredential({
      LAWPLAIN_AGENT_CREDENTIAL: "BAD;NAME",
      CODEGRAFF_API_KEY: "needed",
    }),
    null,
  );
});
