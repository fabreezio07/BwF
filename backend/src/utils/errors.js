class BaseError extends Error {
  constructor(message, code, status, details = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toJSON() {
    return {
      message: this.message,
      code: this.code,
      status: this.status,
      details: this.details
    };
  }
}

export class ValidationError extends BaseError {
  constructor(message = 'Validation failed', details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class ConflictError extends BaseError {
  constructor(message = 'Conflict', details = {}) {
    super(message, 'CONFLICT', 409, details);
  }
}

export class NotFoundError extends BaseError {
  constructor(message = 'Not found', details = {}) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required', details = {}) {
    super(message, 'AUTH_REQUIRED', 401, details);
  }
}

export default BaseError;
