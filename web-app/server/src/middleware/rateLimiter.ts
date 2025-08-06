import { Request, Response, NextFunction } from "express"
import { RateLimitError } from "./errorHandler"

interface RateLimitStore {
	[key: string]: {
		count: number
		resetTime: number
	}
}

class MemoryRateLimitStore {
	private store: RateLimitStore = {}
	private cleanupInterval: NodeJS.Timeout

	constructor() {
		// Clean up expired entries every minute
		this.cleanupInterval = setInterval(() => {
			this.cleanup()
		}, 60 * 1000)
	}

	get(key: string): { count: number; resetTime: number } | undefined {
		return this.store[key]
	}

	set(key: string, value: { count: number; resetTime: number }): void {
		this.store[key] = value
	}

	increment(key: string, windowMs: number): { count: number; resetTime: number } {
		const now = Date.now()
		const existing = this.store[key]

		if (!existing || now > existing.resetTime) {
			// Create new entry or reset expired entry
			const entry = {
				count: 1,
				resetTime: now + windowMs,
			}
			this.store[key] = entry
			return entry
		} else {
			// Increment existing entry
			existing.count++
			return existing
		}
	}

	private cleanup(): void {
		const now = Date.now()
		for (const key in this.store) {
			if (this.store[key].resetTime < now) {
				delete this.store[key]
			}
		}
	}

	destroy(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
		}
		this.store = {}
	}
}

const store = new MemoryRateLimitStore()

export interface RateLimitOptions {
	windowMs?: number
	maxRequests?: number
	message?: string
	keyGenerator?: (req: Request) => string
	skipSuccessfulRequests?: boolean
	skipFailedRequests?: boolean
	onLimitReached?: (req: Request, res: Response) => void
}

export const createRateLimiter = (options: RateLimitOptions = {}) => {
	const {
		windowMs = 15 * 60 * 1000, // 15 minutes
		maxRequests = 100,
		message = "Too many requests, please try again later",
		keyGenerator = (req: Request) => req.ip || "unknown",
		skipSuccessfulRequests = false,
		skipFailedRequests = false,
		onLimitReached,
	} = options

	return (req: Request, res: Response, next: NextFunction): void => {
		const key = keyGenerator(req)
		const entry = store.increment(key, windowMs)

		// Set rate limit headers
		res.set({
			"X-RateLimit-Limit": maxRequests.toString(),
			"X-RateLimit-Remaining": Math.max(0, maxRequests - entry.count).toString(),
			"X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
		})

		if (entry.count > maxRequests) {
			if (onLimitReached) {
				onLimitReached(req, res)
			}

			res.set("Retry-After", Math.ceil((entry.resetTime - Date.now()) / 1000).toString())
			throw new RateLimitError(message)
		}

		// Handle response to potentially skip counting
		if (skipSuccessfulRequests || skipFailedRequests) {
			const originalSend = res.send
			res.send = function (body) {
				const statusCode = res.statusCode
				const shouldSkip = (skipSuccessfulRequests && statusCode < 400) || (skipFailedRequests && statusCode >= 400)

				if (shouldSkip && entry.count > 0) {
					entry.count--
				}

				return originalSend.call(this, body)
			}
		}

		next()
	}
}

// Default rate limiter
export const rateLimiter = createRateLimiter({
	windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
	maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"),
	message: "Too many requests from this IP, please try again later",
})

// Strict rate limiter for sensitive endpoints
export const strictRateLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000, // 15 minutes
	maxRequests: 10,
	message: "Too many attempts, please try again later",
})

// Auth rate limiter
export const authRateLimiter = createRateLimiter({
	windowMs: 15 * 60 * 1000, // 15 minutes
	maxRequests: 5,
	message: "Too many authentication attempts, please try again later",
	keyGenerator: (req: Request) => {
		// Use email/username if provided, otherwise IP
		const body = req.body
		const identifier = body?.email || body?.username || req.ip
		return `auth:${identifier}`
	},
	skipSuccessfulRequests: true, // Only count failed attempts
})

// API rate limiter for authenticated users
export const apiRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 60, // 60 requests per minute
	keyGenerator: (req: Request) => {
		// Use user ID if authenticated, otherwise IP
		const user = (req as any).user
		return user ? `api:user:${user.id}` : `api:ip:${req.ip}`
	},
})

// File upload rate limiter
export const uploadRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 10,
	message: "Too many file uploads, please try again later",
	keyGenerator: (req: Request) => {
		const user = (req as any).user
		return user ? `upload:user:${user.id}` : `upload:ip:${req.ip}`
	},
})

// Terminal rate limiter
export const terminalRateLimiter = createRateLimiter({
	windowMs: 60 * 1000, // 1 minute
	maxRequests: 30,
	message: "Too many terminal commands, please slow down",
	keyGenerator: (req: Request) => {
		const user = (req as any).user
		return `terminal:user:${user?.id || req.ip}`
	},
})

// Cleanup function
export const cleanupRateLimiter = (): void => {
	store.destroy()
}
