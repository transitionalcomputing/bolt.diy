import { InvalidToolInputError, NoSuchToolError, ToolChoiceViolationError } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.errors');

/**
 * Error shape returned by the chat/llmcall routes.
 *
 * This is a wire contract, not an internal detail: Chat.client.tsx parses the
 * failure body and reads `statusCode`, `isRetryable`, `provider` and `message`
 * to pick the alert type (authentication / rate_limit / quota / network). Adding
 * a field is safe; renaming or removing one silently degrades every error alert
 * in the UI to "Request Failed".
 */
export interface ApiErrorBody {
  error: true;
  message: string;
  statusCode: number;
  isRetryable: boolean;
  provider: string;
}

/**
 * A failure with a deliberate HTTP status, so the wrapper does not have to guess.
 *
 * Anything thrown that is *not* an ApiError becomes a 500. That is why a plain
 * `throw new Error('bad input')` in a route used to surface as an opaque server
 * error: there was no way to say "this one is the client's fault".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly isRetryable: boolean;
  readonly provider?: string;

  constructor(
    message: string,
    options: { status?: number; code?: string; isRetryable?: boolean; provider?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });

    this.name = 'ApiError';
    this.status = options.status ?? 500;
    this.code = options.code ?? 'internal_error';
    this.isRetryable = options.isRetryable ?? this.status >= 500;
    this.provider = options.provider;
  }

  /**
   * The wire body for this failure.
   *
   * A getter rather than a plain field because subclasses (PayloadTooLargeError,
   * ValidationError, …) override `name`, so anything identifying this error by
   * its `name` must not be matching on it. See `isTypedApiError` in security.ts.
   */
  get body(): ApiErrorBody {
    return {
      error: true,
      message: this.message,
      statusCode: this.status,
      isRetryable: this.isRetryable,
      provider: this.provider ?? 'unknown',
    };
  }
}

/** The request body could not be parsed, or failed schema validation. */
export class ValidationError extends ApiError {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message, { status: 400, code: 'invalid_request', isRetryable: false });
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/** The body exceeded the route's byte budget. */
export class PayloadTooLargeError extends ApiError {
  constructor(limitBytes: number) {
    super(`Request body is too large. The limit is ${formatBytes(limitBytes)}.`, {
      status: 413,
      code: 'payload_too_large',
      isRetryable: false,
    });
    this.name = 'PayloadTooLargeError';
  }
}

/** The client stopped sending before the body was complete. */
export class RequestTimeoutError extends ApiError {
  constructor(timeoutMs: number) {
    super(`Request body timed out after ${Math.round(timeoutMs / 1000)}s.`, {
      status: 408,
      code: 'request_timeout',
      isRetryable: true,
    });
    this.name = 'RequestTimeoutError';
  }
}

/** The client disconnected mid-body. Not an error worth a stack trace. */
export class RequestAbortedError extends ApiError {
  constructor() {
    super('Request cancelled.', { status: 499, code: 'client_closed_request', isRetryable: false });
    this.name = 'RequestAbortedError';
  }
}

/**
 * Credentials problems, normalised across providers.
 *
 * Every provider phrases this differently ("Incorrect API key", "invalid x-api-key",
 * 401, 403), so the routes matched on substrings of the provider's message. Keep
 * provider diagnostics out of the client response because they can contain
 * request URLs or credential data.
 */
export function toMissingCredentialError(provider: string, providerMessage?: string): ApiError {
  if (providerMessage) {
    logger.warn('Provider credential error');
  }

  return new ApiError('Invalid or missing API key', {
    status: 401,
    code: 'missing_api_key',
    isRetryable: false,
    provider,
  });
}

/** Converts a streaming provider error to a client-safe hint without forwarding diagnostics. */
export function toSafeStreamErrorMessage(error: unknown): string {
  const providerMessage = error instanceof Error ? error.message : String(error);
  const normalizedMessage = providerMessage.toLowerCase();

  const statusCode =
    typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;

  logger.error('Streaming provider diagnostic', JSON.stringify(safeProviderDiagnostic(error)));
  logger.error(`Streaming provider error (${error instanceof Error ? error.name : 'UnknownError'})`);

  if ((error instanceof Error && error.name === 'TimeoutError') || /timeout|timed\s*out/.test(normalizedMessage)) {
    return 'Custom error: The AI provider stopped responding before the next step completed. Completed file changes and tool results are preserved. Retry to continue, or select a different model.';
  }

  if (ToolChoiceViolationError.isInstance(error)) {
    return 'Custom error: The selected model returned text instead of the required tool call, so the build could not continue. Retry or select a model that reliably supports tool calling.';
  }

  if (InvalidToolInputError.isInstance(error) || normalizedMessage.startsWith('invalid input for tool ')) {
    return 'Custom error: The model supplied invalid tool arguments. Retry the tool call using its declared input schema.';
  }

  if (NoSuchToolError.isInstance(error) || normalizedMessage.startsWith('model tried to call unavailable tool ')) {
    return 'Custom error: The model requested an unavailable tool. Use one of the supplied tools instead.';
  }

  if (providerMessage.includes('model') && providerMessage.includes('not found')) {
    return 'Custom error: Invalid model selected. Please check that the model name is correct and available.';
  }

  if (providerMessage.includes('Invalid JSON response')) {
    return 'Custom error: The AI service returned an invalid response. This may be due to an invalid model name, API rate limiting, or server issues. Try selecting a different model or check your API key.';
  }

  if (
    providerMessage.includes('API key') ||
    providerMessage.includes('unauthorized') ||
    providerMessage.includes('authentication')
  ) {
    return 'Custom error: Invalid or missing API key. Please check your API key configuration.';
  }

  if (providerMessage.includes('token') && providerMessage.includes('limit')) {
    return 'Custom error: Token limit exceeded. The conversation is too long for the selected model. Try using a model with larger context window or start a new conversation.';
  }

  if (statusCode === 429 || normalizedMessage.includes('rate limit') || providerMessage.includes('429')) {
    return 'Custom error: API rate limit exceeded, or the provider rejected the request for account reasons. Check your provider account and try again.';
  }

  if (providerMessage.includes('network') || providerMessage.includes('timeout')) {
    return 'Custom error: Network error. Please check your internet connection and try again.';
  }

  return 'Custom error: The AI provider request failed. Check your provider settings and try again.';
}

/** Wraps a plain-text provider stream so late failures become a safe text chunk. */
export function toSafeTextStream(stream: ReadableStream<string>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const encoder = new TextEncoder();

  let failed = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (failed) {
        controller.close();
        return;
      }

      try {
        const { done, value } = await reader.read();

        if (done) {
          reader.releaseLock();
          controller.close();

          return;
        }

        controller.enqueue(encoder.encode(value));
      } catch {
        failed = true;
        logger.error('Streaming provider error');
        reader.releaseLock();
        controller.enqueue(
          encoder.encode('Custom error: The AI provider request failed. Check your provider settings and try again.'),
        );
        controller.close();
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

/** Returns a fixed client-safe token-limit response. */
export function toTokenLimitError(provider: string): ApiError {
  return new ApiError(
    'Token limit exceeded. Try reducing your request size or using a model with higher token limits.',
    {
      status: 400,
      code: 'token_limit_exceeded',
      isRetryable: false,
      provider,
    },
  );
}

/** Identifies provider token-limit diagnostics without forwarding their text. */
export function isTokenLimitFailure(error: unknown): error is Error {
  if (!(error instanceof Error) || isTypedFailure(error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return (
    /\bmax[_ -]?tokens?\b/.test(message) ||
    /\btoken\s+limit\s+(?:exceeded|exceeds|reached)\b/.test(message) ||
    /\b(?:maximum|max)\s+context\s+length\b/.test(message) ||
    /\bcontext\s+length\b.{0,40}\b(?:exceed(?:ed|s)?|maximum|limit)\b/.test(message) ||
    /\btoo\s+many\s+tokens\b/.test(message) ||
    /\brequested\s+tokens\b.{0,40}\b(?:exceed(?:ed|s)?|maximum|limit)\b/.test(message)
  );
}

function isTypedFailure(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && 'status' in error;
}

/**
 * Builds the failure response for a caught error.
 *
 * Deliberately does not echo the raw error message for unexpected errors: a
 * thrown Error from deep inside the provider SDK can contain the request URL,
 * which for several providers embeds the key in a query string. Known ApiErrors
 * carry their own vetted message; anything else becomes a generic string.
 */
export function toApiErrorResponse(error: unknown, fallbackProvider = 'unknown'): Response {
  if (error instanceof ApiError) {
    return Response.json(
      {
        error: true,
        message: error.message,
        statusCode: error.status,
        isRetryable: error.isRetryable,
        provider: error.provider ?? fallbackProvider,
      } satisfies ApiErrorBody,
      { status: error.status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  /*
   * Aborts surface as a generic 500 everywhere else, which makes a user pressing
   * "stop" look like a server fault. 499 is the conventional client-closed code
   * and is not retryable.
   */
  if (isAbortError(error)) {
    return Response.json(
      {
        error: true,
        message: 'Request cancelled.',
        statusCode: 499,
        isRetryable: false,
        provider: fallbackProvider,
      } satisfies ApiErrorBody,
      { status: 499, headers: { 'Content-Type': 'application/json' } },
    );
  }

  logger.error('Unhandled route error');

  return Response.json(
    {
      error: true,
      message: 'An unexpected error occurred',
      statusCode: 500,
      isRetryable: true,
      provider: fallbackProvider,
    } satisfies ApiErrorBody,
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  );
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.code === 'client_closed_request';
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

const PROVIDER_DIAGNOSTIC_TYPES = new Set([
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'AbortError', 'TimeoutError',
  'AI_APICallError', 'AI_RetryError', 'AI_InvalidResponseDataError', 'AI_JSONParseError',
  'AI_TypeValidationError', 'AI_InvalidArgumentError', 'AI_UnsupportedFunctionalityError',
]);
const PROVIDER_DIAGNOSTIC_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'ERR_TLS_CERT_ALTNAME_INVALID', 'ERR_INVALID_URL',
  'invalid_api_key', 'insufficient_quota', 'rate_limit_exceeded', 'model_not_found',
  'invalid_request_error', 'unsupported_parameter', 'context_length_exceeded',
]);

function diagnosticOwnData(object: unknown, key: string): unknown {
  if (!object || (typeof object !== 'object' && typeof object !== 'function')) {
    return undefined;
  }

  try {
    return Object.getOwnPropertyDescriptor(object, key)?.value;
  } catch {
    return undefined;
  }
}

function diagnosticType(error: unknown): string {
  const own = diagnosticOwnData(error, 'name');

  if (typeof own === 'string' && PROVIDER_DIAGNOSTIC_TYPES.has(own)) {
    return own;
  }

  try {
    const prototype = Object.getPrototypeOf(error);

    for (const ctor of [TypeError, RangeError, SyntaxError, Error]) {
      if (prototype === ctor.prototype) {
        return ctor.name;
      }
    }
  } catch {
    // Unknown values must not interrupt error handling.
  }

  return 'UnknownError';
}

function diagnosticCategory(
  status: number | undefined,
  code: string | undefined,
  message: unknown,
  type: string,
): string {
  if (status === 401 || code === 'invalid_api_key') return 'authentication';
  if (status === 403) return 'permission';
  if (status === 429 || code === 'rate_limit_exceeded' || code === 'insufficient_quota') return 'rate_or_quota';
  if (typeof status === 'number' && status >= 500) return 'upstream_server';
  if (code && /CERT|TLS|ISSUER|SIGNATURE/.test(code)) return 'tls';
  if (code === 'ERR_INVALID_URL') return 'invalid_url';
  if (code && /ECONN|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|UND_ERR/.test(code)) return 'transport';
  if (type === 'AbortError') return 'cancelled';
  if (type === 'TimeoutError') return 'timeout';

  // Only fixed classifications leave this function, never message fragments.
  if (typeof message === 'string') {
    if (/fetch failed|failed to fetch|network connection lost/i.test(message)) return 'fetch_failure';
    if (/not a function|cannot read properties|undefined is not|not iterable/i.test(message)) return 'runtime_type';
  }

  if (typeof status === 'number' && status >= 400) return 'upstream_rejection';

  return 'unclassified';
}

/** Bounded, allowlisted diagnostics: never log messages, stacks, bodies, headers, or credentials. */
export function safeProviderDiagnostic(error: unknown) {
  const chain = [];
  const seen = new Set();
  let current = error;

  for (let depth = 0; depth < 4 && current != null; depth++) {
    if (seen.has(current)) break;
    seen.add(current);

    const type = diagnosticType(current);
    const rawStatus = diagnosticOwnData(current, 'statusCode');
    const statusCode =
      typeof rawStatus === 'number' && Number.isInteger(rawStatus) && rawStatus >= 100 && rawStatus <= 599
        ? rawStatus
        : undefined;
    const rawCode = diagnosticOwnData(current, 'code');
    const code = typeof rawCode === 'string' && PROVIDER_DIAGNOSTIC_CODES.has(rawCode) ? rawCode : undefined;

    chain.push({
      depth,
      type,
      ...(statusCode === undefined ? {} : { statusCode }),
      ...(code === undefined ? {} : { code }),
      category: diagnosticCategory(statusCode, code, diagnosticOwnData(current, 'message'), type),
    });
    current = diagnosticOwnData(current, 'cause');
  }

  return { chain };
}
