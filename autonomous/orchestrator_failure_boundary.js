const SAFE_FAILURE_FLAGS = Object.freeze({
  writesEnabled: false,
  outboundMessagingEnabled: false,
  paymentActionsEnabled: false
});

export async function runWithReadOnlyFailureBoundary(analyzer, input = {}) {
  if (typeof analyzer !== 'function') {
    return Object.freeze({
      ok: false,
      error: 'analyzer must be a function',
      ...SAFE_FAILURE_FLAGS
    });
  }

  try {
    const result = await analyzer(input);
    return Object.freeze({
      ok: true,
      result,
      ...SAFE_FAILURE_FLAGS
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      error: error instanceof Error ? error.message : 'read-only analysis failed',
      ...SAFE_FAILURE_FLAGS
    });
  }
}

export { SAFE_FAILURE_FLAGS };