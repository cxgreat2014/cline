import { Router } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import Joi from "joi"
import { User, UserRole } from "@models/User"
import { AppDataSource } from "@/config/database"
import { authRateLimiter, strictRateLimiter } from "@middleware/rateLimiter"
import { asyncHandler, ValidationError, UnauthorizedError, ConflictError } from "@middleware/errorHandler"
import { authMiddleware, AuthenticatedRequest } from "@middleware/auth"

const router = Router()
const userRepository = AppDataSource.getRepository(User)

// Validation schemas
const registerSchema = Joi.object({
	username: Joi.string().alphanum().min(3).max(30).required(),
	email: Joi.string().email().required(),
	password: Joi.string().min(8).max(128).required(),
})

const loginSchema = Joi.object({
	email: Joi.string().email().required(),
	password: Joi.string().required(),
})

const changePasswordSchema = Joi.object({
	currentPassword: Joi.string().required(),
	newPassword: Joi.string().min(8).max(128).required(),
})

const updateProfileSchema = Joi.object({
	username: Joi.string().alphanum().min(3).max(30),
	preferences: Joi.object({
		theme: Joi.string().valid("light", "dark"),
		language: Joi.string(),
		autoApproval: Joi.boolean(),
		notifications: Joi.boolean(),
	}),
})

// Register
router.post(
	"/register",
	authRateLimiter,
	asyncHandler(async (req, res) => {
		const { error, value } = registerSchema.validate(req.body)
		if (error) {
			throw new ValidationError("Invalid registration data", error.details)
		}

		const { username, email, password } = value

		// Check if user already exists
		const existingUser = await userRepository.findOne({
			where: [{ email }, { username }],
		})

		if (existingUser) {
			throw new ConflictError("User with this email or username already exists")
		}

		// Hash password
		const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12")
		const passwordHash = await bcrypt.hash(password, saltRounds)

		// Create user
		const user = new User()
		user.username = username
		user.email = email
		user.passwordHash = passwordHash
		user.role = UserRole.USER
		user.isActive = true
		user.preferences = {
			theme: "dark",
			language: "en",
			autoApproval: false,
			notifications: true,
		}

		await userRepository.save(user)

		// Generate JWT token
		const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" })

		res.status(201).json({
			success: true,
			data: {
				user: user.toJSON(),
				token,
			},
		})
	}),
)

// Login
router.post(
	"/login",
	authRateLimiter,
	asyncHandler(async (req, res) => {
		const { error, value } = loginSchema.validate(req.body)
		if (error) {
			throw new ValidationError("Invalid login data", error.details)
		}

		const { email, password } = value

		// Find user
		const user = await userRepository.findOne({ where: { email } })
		if (!user) {
			throw new UnauthorizedError("Invalid email or password")
		}

		if (!user.isActive) {
			throw new UnauthorizedError("Account is inactive")
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, user.passwordHash)
		if (!isValidPassword) {
			throw new UnauthorizedError("Invalid email or password")
		}

		// Update last login
		user.lastLoginAt = new Date()
		await userRepository.save(user)

		// Generate JWT token
		const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" })

		res.json({
			success: true,
			data: {
				user: user.toJSON(),
				token,
			},
		})
	}),
)

// Get current user
router.get(
	"/me",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		res.json({
			success: true,
			data: {
				user: req.user!.toJSON(),
			},
		})
	}),
)

// Update profile
router.put(
	"/profile",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { error, value } = updateProfileSchema.validate(req.body)
		if (error) {
			throw new ValidationError("Invalid profile data", error.details)
		}

		const user = req.user!
		const { username, preferences } = value

		// Check if username is taken (if changing)
		if (username && username !== user.username) {
			const existingUser = await userRepository.findOne({ where: { username } })
			if (existingUser) {
				throw new ConflictError("Username is already taken")
			}
			user.username = username
		}

		// Update preferences
		if (preferences) {
			user.preferences = {
				...user.preferences,
				...preferences,
			}
		}

		await userRepository.save(user)

		res.json({
			success: true,
			data: {
				user: user.toJSON(),
			},
		})
	}),
)

// Change password
router.put(
	"/password",
	authMiddleware,
	strictRateLimiter,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { error, value } = changePasswordSchema.validate(req.body)
		if (error) {
			throw new ValidationError("Invalid password data", error.details)
		}

		const { currentPassword, newPassword } = value
		const user = req.user!

		// Verify current password
		const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
		if (!isValidPassword) {
			throw new UnauthorizedError("Current password is incorrect")
		}

		// Hash new password
		const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || "12")
		user.passwordHash = await bcrypt.hash(newPassword, saltRounds)

		await userRepository.save(user)

		res.json({
			success: true,
			message: "Password updated successfully",
		})
	}),
)

// Refresh token
router.post(
	"/refresh",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const user = req.user!

		// Generate new JWT token
		const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" })

		res.json({
			success: true,
			data: {
				token,
			},
		})
	}),
)

// Logout (client-side token removal, but we can track it server-side if needed)
router.post(
	"/logout",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		// In a more sophisticated setup, you might want to blacklist the token
		// For now, we just return success and let the client remove the token

		res.json({
			success: true,
			message: "Logged out successfully",
		})
	}),
)

export default router
