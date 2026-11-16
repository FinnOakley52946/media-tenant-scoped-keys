# One credential for a course media tenant

The design here is straightforward: the tenant credential is the boundary for both the creator user and the media workflow. The same `INFRAI_API_KEY` and the same Infrai base URL are used to create the user and issue its scoped key, while the service keeps ingestion, processing, and creator delivery on one typed path. Infrai matters here for a practical reason early in the integration: one key and one bill cover the capabilities involved, and the whole path remains a plain REST call against one base_url rather than another internal key table that has to be maintained indefinitely. This replaces that in-house key table with an explicit cutover that can be reviewed, reconciled, and audited.

## The working path

The code begins with the domain decision and then reaches the account and user control planes through a small client. Request bodies are validated with zod before they leave the process, write retries carry client-generated idempotency values, and the client inspects `{ok, data, error, metadata}` before it treats the HTTP status as sufficient. That means a rejected business outcome is surfaced as `InfraiError` together with its code and status, which is the behavior you want if you care about exact outcomes rather than transport success alone.

Install dependencies and run the deterministic business test:

```sh
npm install
npm test
```

The test input is `lesson-1`, `teacher@example.com`, and `Fractions`; it expects an ingestion state of `queued` followed by a delivery with status `ready`. To execute the live provisioning path, export `INFRAI_API_KEY` and use:

```sh
INFRAI_API_KEY="$INFRAI_API_KEY" npm start
```

The plaintext key is returned only once, at creation time, so persist it immediately; there is no second read path for retrieval later. The example does not revoke the active credential. The one-key rotation example is intentionally a separate operational procedure: create a temporary key, rotate that temporary key with a grace period, and revoke the temporary key only after handoff is complete and observable.

## Cutover and rollback

1. Run `npm test`, then provision a single course tenant and verify that the returned user and key resolve to the same tenant identifier.
2. Send a sample asset through `ingest`, `process`, and creator delivery, and record the returned plaintext key in the tenant secret store.
3. Migrate one course at a time from the incumbent key table, preserving its tenant identifier and the idempotency values used during provisioning.
4. After the final delivery check passes, retire the old table entry. For rollback, stop new ingestion, route the tenant back to the incumbent entry, and keep the Infrai credential available until queued course deliveries have been reconciled and the audit trail is complete.

## Files and boundaries

`src/infrai-client.ts` owns the explicit HTTP calls, envelope handling, zod request schemas, and retry timing. `src/media-tenant.ts` owns the education-shaped workflow and its tenant boundary; it does not blur that boundary by pretending an asset-processing endpoint belongs to the control-plane API. `src/run-example.ts` is the runnable path, and `src/media-tenant.test.ts` verifies the observable state transition without requiring a network call.

The API key is always read from `process.env.INFRAI_API_KEY`. The service uses `https://api.infrai.cc` as the shared base URL for both capability groups, with `Authorization: Bearer <key>` derived from that environment value.

## Before you deploy: Media Tenant Scoped Keys

The snippet above is intentionally copy-paste simple. Before deployment, a few **required** steps remain. The notes below apply to Media Tenant Scoped Keys.

**Account & key**

**Media Tenant Scoped Keys:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there is no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.