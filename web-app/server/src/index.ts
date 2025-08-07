import "reflect-metadata"
import dotenv from "dotenv"
import path from "path"

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, "../../.env") })
import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import morgan from "morgan"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"

import { AppDataSource } from "./config/database"
import { errorHandler } from "./middleware/errorHandler"
import { authMiddleware } from "./middleware/auth"
import { rateLimiter } from "./middleware/rateLimiter"

// API Routes
import authRoutes from "./api/auth"
import repositoryRoutes from "./api/repositories"
import taskRoutes from "./api/tasks"
import fileRoutes from "./api/files"
import terminalRoutes from "./api/terminal"

// Services
import { SocketService } from "./services/SocketService"
import { ClineService } from "./services/ClineService"

const app = express()
const server = createServer(app)
const io = new SocketIOServer(server, {
	cors: {
		origin: process.env.CLIENT_URL || "http://localhost:3000",
		methods: ["GET", "POST"],
	},
})

const PORT = process.env.PORT || 8000

// Middleware
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'"],
				imgSrc: ["'self'", "data:", "https:"],
			},
		},
	}),
)
app.use(
	cors({
		origin: process.env.CLIENT_URL || "http://localhost:3000",
		credentials: true,
	}),
)
app.use(compression())
app.use(morgan("combined"))
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(rateLimiter)

// Health check
app.get("/health", (req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		version: process.env.npm_package_version || "1.0.0",
	})
})

// API Routes
app.use("/api/auth", authRoutes)
app.use("/api/repositories", authMiddleware, repositoryRoutes)
app.use("/api/tasks", authMiddleware, taskRoutes)
app.use("/api/files", authMiddleware, fileRoutes)
app.use("/api/terminal", authMiddleware, terminalRoutes)

// Error handling
app.use(errorHandler)

// Initialize services
const socketService = new SocketService(io)
const clineService = new ClineService(socketService)

// Socket.IO connection handling
io.on("connection", (socket) => {
	console.log(`Client connected: ${socket.id}`)

	socket.on("join-repository", (repositoryId: string) => {
		socket.join(`repo:${repositoryId}`)
		console.log(`Client ${socket.id} joined repository ${repositoryId}`)
	})

	socket.on("leave-repository", (repositoryId: string) => {
		socket.leave(`repo:${repositoryId}`)
		console.log(`Client ${socket.id} left repository ${repositoryId}`)
	})

	socket.on("disconnect", () => {
		console.log(`Client disconnected: ${socket.id}`)
	})
})

// Database initialization and server startup
async function startServer() {
	try {
		// Initialize database
		await AppDataSource.initialize()
		console.log("Database connection established")

		// Start server
		server.listen(PORT, () => {
			console.log(`🚀 Cline Web Server running on port ${PORT}`)
			console.log(`📊 Health check: http://localhost:${PORT}/health`)
			console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`)
		})
	} catch (error) {
		console.error("Failed to start server:", error)
		process.exit(1)
	}
}

// Graceful shutdown
process.on("SIGTERM", async () => {
	console.log("SIGTERM received, shutting down gracefully")
	server.close(() => {
		console.log("HTTP server closed")
		AppDataSource.destroy().then(() => {
			console.log("Database connection closed")
			process.exit(0)
		})
	})
})

process.on("SIGINT", async () => {
	console.log("SIGINT received, shutting down gracefully")
	server.close(() => {
		console.log("HTTP server closed")
		AppDataSource.destroy().then(() => {
			console.log("Database connection closed")
			process.exit(0)
		})
	})
})

startServer()
