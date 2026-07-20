'use strict';

const { APPLICATION_STATES: A, FILE_STATES: F, ERROR_CODES } = require('./constants');

const appTransitions = {
  [A.Initiated]: [A.UploadPending, A.Incomplete, A.Error],
  [A.UploadPending]: [A.Received, A.Incomplete, A.Error],
  [A.Received]: [A.Scanning, A.ManualReview, A.Error],
  [A.Scanning]: [A.Ready, A.ManualReview, A.Blocked, A.Error],
  [A.Ready]: [],
  [A.ManualReview]: [A.Ready, A.Blocked, A.Error],
  [A.Blocked]: [],
  [A.Incomplete]: [A.Error],
  [A.Error]: []
};

const fileTransitions = {
  [F.SASIssued]: [F.Uploaded, F.ValidationFailed, F.Removed],
  [F.Uploaded]: [F.ScanPending, F.ValidationFailed],
  [F.ValidationFailed]: [F.Removed],
  [F.ScanPending]: [F.Clean, F.Malicious, F.ScanFailed, F.ManualReview],
  [F.Clean]: [F.Ready],
  [F.Ready]: [],
  [F.Malicious]: [F.Removed],
  [F.ScanFailed]: [F.ManualReview, F.Removed],
  [F.ManualReview]: [F.Removed, F.Ready],
  [F.Removed]: []
};

function transition(kind, current, next) {
  const transitions = kind === 'application' ? appTransitions : fileTransitions;
  if (current === next) return next;
  if (!transitions[current] || !transitions[current].includes(next)) {
    const error = new Error(`${kind} transition ${current} -> ${next} is not allowed`);
    error.code = ERROR_CODES.STATE_TRANSITION_INVALID;
    throw error;
  }
  return next;
}

module.exports = { transition, appTransitions, fileTransitions };
