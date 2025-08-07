import { CLINE_ACCOUNT_AUTH_ERROR_MESSAGE } from "../../shared/ClineAccount"
import { serializeError } from "serialize-error"
export var ClineErrorType
;(function (ClineErrorType) {
	ClineErrorType["Auth"] = "auth"
	ClineErrorType["Network"] = "network"
	ClineErrorType["RateLimit"] = "rateLimit"
	ClineErrorType["Balance"] = "balance"
})(ClineErrorType || (ClineErrorType = {}))
const RATE_LIMIT_PATTERNS = [/status code 429/i, /rate limit/i, /too many requests/i, /quota exceeded/i, /resource exhausted/i]
export class ClineError extends Error {
	modelId
	providerId
	title = "ClineError"
	_error
	// Error details per providers:
	// Cline: error?.error
	// Ollama: error?.cause
	// tbc
	constructor(raw, modelId, providerId) {
		const error = serializeError(raw)
		const message = error.message || String(error) || error?.cause?.means
		super(message)
		this.modelId = modelId
		this.providerId = providerId
		// Extract status from multiple possible locations
		const status = error.status || error.statusCode || error.response?.status
		// Construct the error details object to includes relevant information
		// And ensure it has a consistent structure
		this._error = {
			message: raw.message || message,
			status,
			request_id: error.request_id || error.response?.request_id,
			code: error.code || error?.cause?.code,
			modelId,
			providerId,
			details: error.details || error.error, // Additional details provided by the server
			...error,
			stack: undefined, // Avoid serializing stack trace to keep the error object clean
		}
	}
	/**
	 *  Serializes the error to a JSON string that allows for easy transmission and storage.
	 *  This is useful for logging or sending error details to a webviews.
	 */
	serialize() {
		return JSON.stringify({
			message: this.message,
			status: this._error.status,
			request_id: this._error.request_id,
			code: this._error.code,
			modelId: this.modelId,
			providerId: this.providerId,
			details: this._error.details,
		})
	}
	/**
	 * Parses a stringified error into a ClineError instance.
	 */
	static parse(errorStr, modelId) {
		if (!errorStr || typeof errorStr !== "string") {
			return undefined
		}
		return ClineError.transform(errorStr, modelId)
	}
	/**
	 * Transforms any object into a ClineError instance.
	 * Always returns a ClineError, even if the input is not a valid error object.
	 */
	static transform(error, modelId, providerId) {
		try {
			return new ClineError(JSON.parse(error), modelId, providerId)
		} catch {
			return new ClineError(error, modelId, providerId)
		}
	}
	isErrorType(type) {
		return ClineError.getErrorType(this) === type
	}
	/**
	 * Is known error type based on the error code, status, and details.
	 * This is useful for determining how to handle the error in the UI or logic.
	 */
	static getErrorType(err) {
		const { code, status, details } = err._error
		// Check balance error first (most specific)
		if (code === "insufficient_credits" && typeof details?.current_balance === "number") {
			return ClineErrorType.Balance
		}
		// Check auth errors
		if (code === "ERR_BAD_REQUEST" || status === 401) {
			return ClineErrorType.Auth
		}
		// Check for auth message (only if message exists)
		const message = err.message
		if (message?.includes(CLINE_ACCOUNT_AUTH_ERROR_MESSAGE)) {
			return ClineErrorType.Auth
		}
		// Check rate limit patterns
		if (message) {
			const lowerMessage = message.toLowerCase()
			if (RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(lowerMessage))) {
				return ClineErrorType.RateLimit
			}
		}
		return undefined
	}
}
//# sourceMappingURL=ClineError.js.map
