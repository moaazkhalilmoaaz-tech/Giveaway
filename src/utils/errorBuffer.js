const ERROR_BUFFER_LIMIT = 8;
const errorBuffer = [];

function logError(err) {
  try {
    const message =
      err?.stack ||
      err?.message ||
      (typeof err === 'string' ? err : JSON.stringify(err));

    errorBuffer.unshift({
      time: new Date(),
      message: String(message),
    });

    if (errorBuffer.length > ERROR_BUFFER_LIMIT) errorBuffer.pop();
  } catch (e) {
    // last resort
    errorBuffer.unshift({ time: new Date(), message: 'Unknown error (logError failed)' });
    if (errorBuffer.length > ERROR_BUFFER_LIMIT) errorBuffer.pop();
  }
}

function getErrors() {
  return [...errorBuffer];
}

module.exports = { logError, getErrors };
