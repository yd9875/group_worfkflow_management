import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decryptOrganizationAiApiKey,
  encryptOrganizationAiApiKey,
} from "@/lib/organization-ai-secret";

const previousSecret = process.env.BETTER_AUTH_SECRET;

beforeAll(() => {
  process.env.BETTER_AUTH_SECRET = "test-only-organization-ai-secret-at-least-32-characters";
});

afterAll(() => {
  if (previousSecret === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = previousSecret;
});

describe("조직 공용 AI API 키 암호화", () => {
  it("같은 조직에서만 API 키를 복호화한다", () => {
    const organizationId = "1f31a852-1158-4f98-a5d8-574d07947b89";
    const apiKey = "sk-test-secret-key-that-must-not-be-stored-in-plain-text";
    const ciphertext = encryptOrganizationAiApiKey(organizationId, apiKey);

    expect(ciphertext).not.toContain(apiKey);
    expect(decryptOrganizationAiApiKey(organizationId, ciphertext)).toBe(apiKey);
    expect(() => decryptOrganizationAiApiKey("26b22f97-02ef-4511-b341-49c506b92f3e", ciphertext)).toThrow();
  });
});
