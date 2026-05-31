class UserFacingError extends Error {
  constructor(message, code = "BAD_REQUEST", status = 400, details = null) {
    super(message);
    this.name = "UserFacingError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = {
  UserFacingError,
};
