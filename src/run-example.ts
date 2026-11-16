import { InfraiClient, infrai } from "./infrai-client.ts";
import { MediaTenant } from "./media-tenant.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before running the live example.");
const recipient = process.env.INFRAI_RECIPIENT;
if (!recipient) throw new Error("Set INFRAI_RECIPIENT before running the live example.");

const tenant = new MediaTenant(new InfraiClient(key), "tenant-course-7");
console.log(`Using ${infrai.account.keys.create} and ${infrai.auth.user.create} with one credential.`);
const provisioned = await tenant.provision(recipient);
const queued = tenant.ingest({ assetId: "lesson-1", creatorEmail: recipient, title: "Fractions" });
const delivered = tenant.process(queued.asset);
console.log(JSON.stringify({ provisioned: provisioned.tenantId, queued, delivered }, null, 2));
