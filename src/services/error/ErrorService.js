import * as pkg from "../../../package.json"
import { ClineError } from "./ClineError"
const isDev = process.env.IS_DEV === "true"
export class ErrorService {
	posthogProvider
	constructor(posthogProvider, _distinctId) {
		this.posthogProvider = posthogProvider
	}
	logException(error) {
		const errorDetails = {
			message: error.message,
			stack: error.stack,
			name: error.name,
			extension_version: pkg.version,
			is_dev: isDev,
		}
		if (error instanceof ClineError) {
			Object.assign(errorDetails, {
				modelId: error.modelId,
				providerId: error.providerId,
				serialized_error: error.serialize(),
			})
		}
		this.posthogProvider.log("extension.error", {
			error_type: "exception",
			...errorDetails,
			timestamp: new Date().toISOString(),
		})
		console.error("[ErrorService] Logging", error)
	}
	logMessage(message, level = "log") {
		this.posthogProvider.log("extension.message", {
			message: message.substring(0, 500),
			level,
			extension_version: pkg.version,
			is_dev: isDev,
			timestamp: new Date().toISOString(),
		})
	}
	toClineError(rawError, modelId, providerId) {
		const transformed = ClineError.transform(rawError, modelId, providerId)
		this.logException(transformed)
		return transformed
	}
}
//# sourceMappingURL=ErrorService.js.map
