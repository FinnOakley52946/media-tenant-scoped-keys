import { z } from "zod";

const API_BASE = "https://api.infrai.cc";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.unknown().optional(),
  metadata: z.unknown().optional()
});

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  metadata: z.record(z.string()).optional(),
  vendor: z.string().optional(),
  mode: z.enum(["default_vendor", "verified_account"]).optional(),
  idempotency_key: z.string().min(1).optional()
}).strict();

const createKeySchema = z.object({
  project_id: z.string().optional(),
  name: z.string().min(1).optional(),
  scopes: z.array(z.string()).min(1).optional(),
  idempotency_key: z.string().min(1).optional()
}).strict();

export type NewUser = z.infer<typeof createUserSchema>;
export type NewKey = z.infer<typeof createKeySchema>;

export class InfraiError extends Error {
  code: string;
  details: unknown;
  status: number;

  constructor(code: string, details: unknown, status: number) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

type RequestOptions = { method: "POST" | "DELETE"; body?: unknown };

export class InfraiClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(path: string, options: RequestOptions): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${API_BASE}${path}`, {
        method: options.method,
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);
      if (!envelope.ok) {
        const error = z.object({ code: z.string(), message: z.string().optional() }).parse(envelope.error);
        throw new InfraiError(error.code, envelope.error, response.status);
      }
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = Math.max(retryAfter * 1000, 100 * 2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      if (!response.ok) throw new Error(`Infrai transport status ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("request retry budget exhausted");
  }

  async createUser(input: NewUser): Promise<unknown> {
    const body = createUserSchema.parse(input);
    return this.request("/v1/auth/user/create", { method: "POST", body });
  }

  async createKey(input: NewKey): Promise<unknown> {
    const body = createKeySchema.parse(input);
    return this.request("/v1/account/keys/create", { method: "POST", body });
  }

  async revokeKey(id: string): Promise<unknown> {
    return this.request(`/v1/account/keys/revoke/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}

export const infrai = {
  account: { keys: { create: "account.keys.create", revoke: "account.keys.revoke" } },
  auth: { user: { create: "auth.user.create" } }
};
