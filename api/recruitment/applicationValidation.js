// Phase 2 recruitment application scaffold restored for review.
// Not wired into the static site; do not deploy or enable submissions in Phase 1.1.
'use strict';

// Reference server-side validation for recruitment application submissions.
//
// This module is intentionally framework-agnostic and dependency-free so it can be unit
// tested and later dropped into an Azure Functions handler (see handler.js). It contains NO
// secrets, NO network calls, and NO storage logic. It is intended to supersede any future Phase 2 client-side checks. Browser checks are a
// usability aid only; these checks are the real gate.

const { matchesAccepted } = require('./fileSignatures');

// Canonical error codes shared with the frontend contract. Candidate-facing messages are
// mapped from these on the client; the backend never returns infrastructure detail.
const ERROR_CODES = {
  ROLE_NOT_FOUND: 'ROLE_NOT_FOUND',
  ROLE_NOT_OPEN: 'ROLE_NOT_OPEN',
  ROLE_CLOSED: 'ROLE_CLOSED',
  APPLICATION_DEADLINE_PASSED: 'APPLICATION_DEADLINE_PASSED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  FILE_MISSING: 'FILE_MISSING',
  FILE_TYPE_REJECTED: 'FILE_TYPE_REJECTED',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_SIGNATURE_REJECTED: 'FILE_SIGNATURE_REJECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  MALWARE_SCAN_FAILED: 'MALWARE_SCAN_FAILED',
  STORAGE_FAILED: 'STORAGE_FAILED',
  SUBMISSION_FAILED: 'SUBMISSION_FAILED'
};

const SUPPORTED_LOCALES = { en: true, 'zh-CN': true };
const SOURCE_ALLOWLIST = { website: true, linkedin: true, direct: true, other: true };

function isValidRoleId(roleId) {
  return typeof roleId === 'string' && /^[a-z0-9][a-z0-9-]{2,80}$/.test(roleId);
}

function normalizeSource(raw) {
  return typeof raw === 'string' && Object.prototype.hasOwnProperty.call(SOURCE_ALLOWLIST, raw) ? raw : 'direct';
}

function normalizeEmail(value) {
  // Cautious normalization only: trim and lowercase the domain. Do not rewrite the local part.
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  const at = trimmed.lastIndexOf('@');
  if (at === -1) return trimmed;
  return trimmed.slice(0, at) + '@' + trimmed.slice(at + 1).toLowerCase();
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isValidLinkedin(value) {
  if (typeof value !== 'string' || value.trim() === '') return true; // optional
  const t = value.trim();
  return /^https:\/\//i.test(t) && /(^|\.)linkedin\.[a-z.]{2,}\//i.test(t) && t.length <= 300;
}

function deadlineHasPassed(value, now) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T23:59:59Z' : value;
  const time = Date.parse(iso);
  return !isNaN(time) && time < (now ? now.getTime() : Date.now());
}

function getCvRules(role) {
  if (!role || !Array.isArray(role.files)) return null;
  return role.files.find((f) => f && f.filePurpose === 'cv') || null;
}

// Resolve the role from the authoritative (server-bundled) manifest. Returns { ok, role }
// or { ok:false, errorCode }.
function resolveServerRole(manifest, roleId, locale, now) {
  if (!isValidRoleId(roleId)) return { ok: false, errorCode: ERROR_CODES.ROLE_NOT_FOUND };
  if (!manifest || !Array.isArray(manifest.roles)) return { ok: false, errorCode: ERROR_CODES.SUBMISSION_FAILED };
  const role = manifest.roles.find((r) => r && r.roleId === roleId);
  if (!role) return { ok: false, errorCode: ERROR_CODES.ROLE_NOT_FOUND };
  if (role.status === 'closed' || role.status === 'archived') return { ok: false, errorCode: ERROR_CODES.ROLE_CLOSED };
  if (role.status !== 'active') return { ok: false, errorCode: ERROR_CODES.ROLE_NOT_OPEN };
  if (role.applicationEnabled !== true) return { ok: false, errorCode: ERROR_CODES.ROLE_NOT_OPEN };
  if (deadlineHasPassed(role.applicationDeadline, now)) return { ok: false, errorCode: ERROR_CODES.APPLICATION_DEADLINE_PASSED };
  if (!SUPPORTED_LOCALES[locale] || !role.locales || !role.locales[locale]) return { ok: false, errorCode: ERROR_CODES.VALIDATION_FAILED };
  return { ok: true, role: role };
}

// Validate the candidate text fields. Returns { ok } or { ok:false, errorCode, fields:[...] }.
function validateFields(fields) {
  const invalid = [];
  const required = ['fullName', 'email', 'location', 'applicationStatement'];
  required.forEach((name) => {
    if (typeof fields[name] !== 'string' || fields[name].trim() === '') invalid.push(name);
  });
  if (typeof fields.email === 'string' && !isValidEmail(fields.email.trim())) invalid.push('email');
  if (!isValidLinkedin(fields.linkedinUrl)) invalid.push('linkedinUrl');
  if (fields.privacyAccepted !== true && fields.privacyAccepted !== 'true') invalid.push('privacyAccepted');
  // Bound field lengths defensively.
  if (typeof fields.fullName === 'string' && fields.fullName.length > 200) invalid.push('fullName');
  if (typeof fields.applicationStatement === 'string' && fields.applicationStatement.length > 8000) invalid.push('applicationStatement');
  if (invalid.length) return { ok: false, errorCode: ERROR_CODES.VALIDATION_FAILED, fields: Array.from(new Set(invalid)) };
  return { ok: true };
}

function extensionOf(name) {
  if (typeof name !== 'string') return '';
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
}

// Validate the uploaded CV against the manifest rules AND the actual byte signature.
// file: { name, type, size, bytes }. bytes is a Buffer/array of the file header (or whole file).
function validateFile(file, cvRules) {
  if (!file) return { ok: false, errorCode: ERROR_CODES.FILE_MISSING };
  const rules = cvRules || {};
  const exts = rules.allowedExtensions || ['.pdf', '.doc', '.docx'];
  const mimes = rules.allowedMimeTypes || [];
  const maxBytes = rules.maxSizeBytes || 10485760;
  const ext = extensionOf(file.name);
  if (exts.indexOf(ext) === -1) return { ok: false, errorCode: ERROR_CODES.FILE_TYPE_REJECTED };
  if (mimes.length && file.type && mimes.indexOf(file.type) === -1) return { ok: false, errorCode: ERROR_CODES.FILE_TYPE_REJECTED };
  if (typeof file.size === 'number' && file.size > maxBytes) return { ok: false, errorCode: ERROR_CODES.FILE_TOO_LARGE };
  const accepted = (rules.signatureValidation && rules.signatureValidation.acceptedSignatures) || ['pdf', 'oleCompoundFile', 'zipDocx'];
  if (!matchesAccepted(file.bytes, accepted)) return { ok: false, errorCode: ERROR_CODES.FILE_SIGNATURE_REJECTED };
  return { ok: true };
}

// Produce a safe, randomized stored filename. The candidate's original name is never used as
// the stored path (it may be kept as controlled metadata elsewhere).
function safeStoredFilename(applicationReference, originalName, randomId) {
  const ext = extensionOf(originalName);
  const safeExt = ['.pdf', '.doc', '.docx'].indexOf(ext) !== -1 ? ext : '.bin';
  const ref = /^[A-Za-z0-9-]{1,40}$/.test(applicationReference) ? applicationReference : 'APP';
  const rand = /^[A-Za-z0-9]{1,40}$/.test(randomId) ? randomId : 'x';
  return ref + '-' + rand + safeExt;
}

// Guard against path traversal in any incoming filename.
function hasPathTraversal(name) {
  return typeof name === 'string' && (name.indexOf('..') !== -1 || name.indexOf('/') !== -1 || name.indexOf('\\') !== -1 || /^[a-zA-Z]:/.test(name));
}

// Full submission validation pipeline (pre-storage). Storage, scanning, rate limiting, and
// record creation are performed by the handler with injected dependencies.
function validateSubmission(input, options) {
  options = options || {};
  const now = options.now;
  const roleResult = resolveServerRole(options.manifest, input.roleId, input.locale, now);
  if (!roleResult.ok) return roleResult;
  const cvRules = getCvRules(roleResult.role);
  const fieldResult = validateFields(input);
  if (!fieldResult.ok) return fieldResult;
  const fileResult = validateFile(input.cv, cvRules);
  if (!fileResult.ok) return fileResult;
  return { ok: true, role: roleResult.role, normalizedEmail: normalizeEmail(input.email), normalizedSource: normalizeSource(input.source) };
}

module.exports = {
  ERROR_CODES,
  isValidRoleId,
  normalizeSource,
  normalizeEmail,
  isValidEmail,
  isValidLinkedin,
  deadlineHasPassed,
  resolveServerRole,
  validateFields,
  validateFile,
  safeStoredFilename,
  hasPathTraversal,
  validateSubmission
};
