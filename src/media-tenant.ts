import { z } from "zod";
import { InfraiClient } from "./infrai-client.ts";

const assetSchema = z.object({
  assetId: z.string().min(1),
  creatorEmail: z.string().email(),
  title: z.string().min(1)
});

export type Asset = z.infer<typeof assetSchema>;
export type Delivery = { assetId: string; creatorEmail: string; status: "ready" };

export class MediaTenant {
  private client: InfraiClient;
  private tenantId: string;

  constructor(client: InfraiClient, tenantId: string) {
    this.client = client;
    this.tenantId = tenantId;
  }

  async provision(email: string): Promise<{ tenantId: string; credential: unknown }> {
    const user = await this.client.createUser({
      email,
      password: "course-tenant-password",
      name: "Course creator",
      metadata: { tenant_id: this.tenantId, role: "creator" },
      idempotency_key: `user-${this.tenantId}`
    });
    const credential = await this.client.createKey({
      name: `media-${this.tenantId}`,
      scopes: ["media:ingest", "media:process", "media:deliver"],
      idempotency_key: `key-${this.tenantId}`
    });
    return { tenantId: this.tenantId, credential: { user, key: credential, note: "Store the plaintext key now; it cannot be retrieved a second time." } };
  }

  async revokeTemporaryKey(keyId: string): Promise<unknown> {
    return this.client.revokeKey(keyId);
  }

  ingest(asset: Asset): { state: "queued"; asset: Asset; tenantId: string } {
    return { state: "queued", asset: assetSchema.parse(asset), tenantId: this.tenantId };
  }

  process(asset: Asset): Delivery {
    const checked = assetSchema.parse(asset);
    return { assetId: checked.assetId, creatorEmail: checked.creatorEmail, status: "ready" };
  }
}
