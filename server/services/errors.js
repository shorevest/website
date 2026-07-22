'use strict';

/** Typed service errors. The API layer maps `.status` to HTTP status codes. */

class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    this.status = 400;
    this.details = details;
  }
}

class NotFoundError extends Error {
  constructor(what) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
    this.status = 404;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConflictError';
    this.code = 'CONFLICT';
    this.status = 409;
  }
}

module.exports = { ValidationError, NotFoundError, ConflictError };
