import assert from "node:assert/strict";
import { MediaTenant } from "./media-tenant.ts";

const service = new MediaTenant({} as never, "tenant-course-7");
const queued = service.ingest({ assetId: "lesson-1", creatorEmail: "teacher@example.com", title: "Fractions" });
const delivered = service.process(queued.asset);

assert.equal(queued.state, "queued");
assert.deepEqual(delivered, { assetId: "lesson-1", creatorEmail: "teacher@example.com", status: "ready" });
console.log("media decision test passed");
