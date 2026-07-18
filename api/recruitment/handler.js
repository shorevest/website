'use strict';

// REFERENCE HANDLER — NOT DEPLOYED.
//
// This file documents, in runnable form, how the approved backend should orchestrate a
// recruitment application submission. It is deliberately NOT wired to any host in this
// repository: there is no host.json / function.json, and nothing here is registered as an
// Azure Function trigger. It cannot receive traffic as checked in. See
// docs/recruitment-application-backend.md for the full production design and the Azure
// resources that must be created before any of this runs.
//
// It takes all side-effecting collaborators (storage, register, scanner, mailer, rate
// limiter, idempotency store, manifest loader, id generator) as injected dependencies. There
// are NO secrets, credentials, tenant IDs, storage keys, or email addresses in this file.
// Real implementations must use managed identity / environment configuration.

const validation = require('./applicationValidation');
const { ERROR_CODES } = validation;

function fail(code) { return { status: 200, body: { success: false, errorCode: code } }; }
function ok(reference) { return { status: 200, body: { success: true, applicationReference: reference } }; }

// deps: {
//   loadManifest(): manifest            // authoritative, server-bundled copy
//   now(): Date
//   rateLimiter.check(clientKey): {allowed}
//   idempotency.get(key)/put(key, ref)  // dedupe retries; key is server-derived, never email alone
//   generateReference(): string         // e.g. SV-2026-000001 (non-sensitive)
//   generateRandomId(): string
//   storage.store({ containerHint, storedName, bytes }): {ok}
//   register.create(record): {ok}
//   log(event, fields)                  // structured logging; NO CV bytes / minimal PII
// }
async function handleApplication(request, deps) {
  // 1. Strict request-size + parse limits are enforced by the host/binding config before this
  //    runs; the handler assumes `request.fields` and `request.file` are already parsed.
  const fields = request.fields || {};
  const file = request.file || null;

  // 2. Rate limiting / bot controls.
  if (deps.rateLimiter && !deps.rateLimiter.check(request.clientKey).allowed) {
    deps.log && deps.log('rate_limited', { roleId: fields.roleId });
    return fail(ERROR_CODES.RATE_LIMITED);
  }

  // 3. Server-authoritative role + field + file validation (incl. real signature check).
  const manifest = deps.loadManifest();
  const now = deps.now ? deps.now() : new Date();
  const result = validation.validateSubmission(
    {
      roleId: fields.roleId,
      locale: fields.locale,
      source: fields.source,
      fullName: fields.fullName,
      email: fields.email,
      location: fields.location,
      linkedinUrl: fields.linkedinUrl,
      applicationStatement: fields.applicationStatement,
      privacyAccepted: fields.privacyAccepted,
      cv: file
    },
    { manifest: manifest, now: now }
  );
  if (!result.ok) {
    deps.log && deps.log('validation_failed', { roleId: fields.roleId, errorCode: result.errorCode });
    return fail(result.errorCode);
  }

  // 4. Path-traversal guard on the declared filename (used only for metadata, never as a path).
  if (file && validation.hasPathTraversal(file.name)) {
    return fail(ERROR_CODES.VALIDATION_FAILED);
  }

  // 5. Idempotency: if a server-derived submission key was already processed, return the same
  //    reference instead of creating a duplicate record. The key must NOT be the email alone.
  const idemKey = request.idempotencyKey || null;
  if (idemKey && deps.idempotency) {
    const existing = deps.idempotency.get(idemKey);
    if (existing) return ok(existing);
  }

  const reference = deps.generateReference();
  const randomId = deps.generateRandomId();
  const storedName = validation.safeStoredFilename(reference, file.name, randomId);

  // 6. Store the CV in restricted (private, non-public) storage / quarantine. Never a public
  //    link, never an email attachment.
  const stored = await Promise.resolve(deps.storage.store({
    roleId: result.role.roleId,
    year: String(now.getUTCFullYear()),
    storedName: storedName,
    bytes: file.bytes,
    originalNameMetadata: file.name
  }));
  if (!stored || stored.ok !== true) {
    deps.log && deps.log('storage_failed', { roleId: result.role.roleId, reference: reference });
    return fail(ERROR_CODES.STORAGE_FAILED);
  }

  // 7. Create the structured application register record (SharePoint List / Dataverse).
  const created = await Promise.resolve(deps.register.create({
    applicationReference: reference,
    roleId: result.role.roleId,
    // roleTitle/roleTeam/roleLocation from the browser are untrusted; overwrite from manifest.
    roleTitle: result.role.locales[fields.locale].title,
    roleTeam: result.role.locales[fields.locale].team,
    roleLocation: result.role.locales[fields.locale].location,
    locale: fields.locale,
    source: result.normalizedSource,
    candidateName: String(fields.fullName).trim(),
    candidateEmail: result.normalizedEmail,
    candidateTelephone: (fields.telephone || '').trim(),
    candidateLocation: String(fields.location).trim(),
    linkedinUrl: (fields.linkedinUrl || '').trim(),
    applicationStatement: String(fields.applicationStatement).trim(),
    storedFileName: storedName,
    privacyNoticeVersion: fields.privacyNoticeVersion || null,
    submittedAtClientUtc: fields.submittedAtClientUtc || null,
    submittedAtServerUtc: now.toISOString(),
    submissionStatus: 'Received',
    hiringStage: 'New'
  }));
  if (!created || created.ok !== true) {
    deps.log && deps.log('register_failed', { reference: reference });
    return fail(ERROR_CODES.SUBMISSION_FAILED);
  }

  if (idemKey && deps.idempotency) deps.idempotency.put(idemKey, reference);
  deps.log && deps.log('application_received', { reference: reference, roleId: result.role.roleId });

  // 8. Candidate acknowledgement (Microsoft Graph) is triggered by the register/notification
  //    pipeline, not by attaching a CV here.
  return ok(reference);
}

module.exports = { handleApplication };
