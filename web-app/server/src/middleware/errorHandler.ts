import { Request, Response, NextFunction } from "express"

export interface ApiError extends Error {
	statusCode?: number
	code?: string
	details?: any
}

export class ValidationError extends Error {
	statusCode = 400
	code = "VALIDATION_ERROR"

	constructor(
		message: string,
		public details?: any,
	) {
		super(message)
		this.name = "ValidationError"
	}
}

export class NotFoundError extends Error {
	statusCode = 404
	code = "NOT_FOUND"

	constructor(message: string = "Resource not found") {
		super(message)
		this.name = "NotFoundError"
	}
}

export class UnauthorizedError extends Error {
	statusCode = 401
	code = "UNAUTHORIZED"

	constructor(message: string = "Unauthorized") {
		super(message)
		this.name = "UnauthorizedError"
	}
}

export class ForbiddenError extends Error {
	statusCode = 403
	code = "FORBIDDEN"

	constructor(message: string = "Forbidden") {
		super(message)
		this.name = "ForbiddenError"
	}
}

export class ConflictError extends Error {
	statusCode = 409
	code = "CONFLICT"

	constructor(message: string) {
		super(message)
		this.name = "ConflictError"
	}
}

export class RateLimitError extends Error {
	statusCode = 429
	code = "RATE_LIMIT_EXCEEDED"

	constructor(message: string = "Rate limit exceeded") {
		super(message)
		this.name = "RateLimitError"
	}
}

export const errorHandler = (error: ApiError, req: Request, res: Response, next: NextFunction): void => {
	// Log error details
	console.error("API Error:", {
		message: error.message,
		stack: error.stack,
		url: req.url,
		method: req.method,
		ip: req.ip,
		userAgent: req.get("User-Agent"),
		timestamp: new Date().toISOString(),
	})

	// Default error response
	let statusCode = error.statusCode || 500
	let code = error.code || "INTERNAL_SERVER_ERROR"
	let message = error.message || "Internal server error"
	let details = error.details

	// Handle specific error types
	if (error.name === "ValidationError") {
		statusCode = 400
		code = "VALIDATION_ERROR"
	} else if (error.name === "CastError") {
		statusCode = 400
		code = "INVALID_ID"
		message = "Invalid ID format"
	} else if (error.name === "MongoError" || error.name === "MongoServerError") {
		if ((error as any).code === 11000) {
			statusCode = 409
			code = "DUPLICATE_KEY"
			message = "Resource already exists"
		}
	} else if (error.name === "JsonWebTokenError") {
		statusCode = 401
		code = "INVALID_TOKEN"
		message = "Invalid authentication token"
	} else if (error.name === "TokenExpiredError") {
		statusCode = 401
		code = "TOKEN_EXPIRED"
		message = "Authentication token expired"
	} else if (error.name === "MulterError") {
		statusCode = 400
		code = "FILE_UPLOAD_ERROR"

		if ((error as any).code === "LIMIT_FILE_SIZE") {
			message = "File too large"
		} else if ((error as any).code === "LIMIT_FILE_COUNT") {
			message = "Too many files"
		} else if ((error as any).code === "LIMIT_UNEXPECTED_FILE") {
			message = "Unexpected file field"
		}
	}

	// Don't expose internal errors in production
	if (statusCode === 500 && process.env.NODE_ENV === "production") {
		message = "Internal server error"
		details = undefined
	}

	// Send error response
	const errorResponse: any = {
		success: false,
		error: {
			code,
			message,
		},
	}

	if (details && process.env.NODE_ENV !== "production") {
		errorResponse.error.details = details
	}

	if (process.env.NODE_ENV === "development") {
		errorResponse.error.stack = error.stack
	}

	res.status(statusCode).json(errorResponse)
}

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
	const error = new NotFoundError(`Route ${req.method} ${req.path} not found`)
	next(error)
}

export const asyncHandler = (fn: Function) => {
	return (req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next)
	}
}
