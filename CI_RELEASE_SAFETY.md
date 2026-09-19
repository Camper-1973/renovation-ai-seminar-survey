# CI/CD safety — 2026-09-19

main is the source of truth. Only main runs may publish. Manual workflows use the same gates.

Test -> exact payload artifact -> source-only Preview -> existing deployment update. Release needs successful test AND Preview. The current Preview deliberately fails because authenticated /dev evidence is missing; a successful clasp push is not a runtime test. Do not remove this stop or mark it continue-on-error to release. Implement read-only /dev assertions against the captured payload before enabling Release.

Authenticated /dev rendering/navigation remains unautomated. Local mocks check calculation, legacy 38-to-39-column save, deduplication, event aggregation, dashboard link and rarity boundaries (3/5/10 percent).

ci/verify.cjs compiles GAS and executable inline JavaScript, validates JSON and template delimiter balance, and executes available pure regression functions. Template balance is not HtmlService rendering verification. No real spreadsheet, Gmail, Chat or PDF APIs are called. Existing functions and thresholds are unchanged.

The release workflow retains existing Script IDs, Secrets and existing deployment update commands. No new deployment or separate DEV project is created. Payload artifacts pin the exact tested sources; summaries record source SHAs and job outcomes. Workflow concurrency serializes production-source writers within the repository. The legacy Preview entry point delegates to the same strict pipeline and cannot bypass tests.

Background (self-diagnosis only): existing Customer Flow CI -> assembled background syntax/classifier tests -> push, with no Web App deployment update.
