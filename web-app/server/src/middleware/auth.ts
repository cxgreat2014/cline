import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { User, UserRole } from "../models/User"
import { AppDataSource } from "../config/database"

export interface AuthenticatedRequest extends Request {
	user?: User
}

export const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		const token = req.header("Authorization")?.replace("Bearer ", "")

		if (!token) {
			res.status(401).json({ error: "Access denied. No token provided." })
			return
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
		const userRepository = AppDataSource.getRepository(User)

		const user = await userRepository.findOne({
			where: { id: decoded.userId },
			select: ["id", "username", "email", "role", "isActive", "preferences"],
		})

		if (!user) {
			res.status(401).json({ error: "Invalid token. User not found." })
			return
		}

		if (!user.isActive) {
			res.status(401).json({ error: "Account is inactive." })
			return
		}

		// Update last login time
		user.lastLoginAt = new Date()
		await userRepository.save(user)

		req.user = user
		next()
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError) {
			res.status(401).json({ error: "Invalid token." })
		} else if (error instanceof jwt.TokenExpiredError) {
			res.status(401).json({ error: "Token expired." })
		} else {
			console.error("Auth middleware error:", error)
			res.status(500).json({ error: "Internal server error." })
		}
	}
}

export const requireRole = (roles: UserRole | UserRole[]) => {
	return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
		if (!req.user) {
			res.status(401).json({ error: "Authentication required." })
			return
		}

		const allowedRoles = Array.isArray(roles) ? roles : [roles]

		if (!allowedRoles.includes(req.user.role)) {
			res.status(403).json({
				error: "Insufficient permissions.",
				required: allowedRoles,
				current: req.user.role,
			})
			return
		}

		next()
	}
}

export const requireAdmin = requireRole(UserRole.ADMIN)

export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
	try {
		const token = req.header("Authorization")?.replace("Bearer ", "")

		if (token) {
			const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
			const userRepository = AppDataSource.getRepository(User)

			const user = await userRepository.findOne({
				where: { id: decoded.userId, isActive: true },
				select: ["id", "username", "email", "role", "isActive", "preferences"],
			})

			if (user) {
				req.user = user
			}
		}

		next()
	} catch (error) {
		// Ignore auth errors for optional auth
		next()
	}
}
