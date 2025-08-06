import { Server as SocketIOServer, Socket } from "socket.io"
import { EventEmitter } from "events"
import jwt from "jsonwebtoken"
import { User } from "@models/User"
import { AppDataSource } from "@/config/database"

export interface SocketUser {
	id: string
	username: string
	email: string
	role: string
}

export interface AuthenticatedSocket extends Socket {
	user?: SocketUser
}

export class SocketService extends EventEmitter {
	private io: SocketIOServer
	private authenticatedSockets = new Map<string, AuthenticatedSocket>()
	private userRepository = AppDataSource.getRepository(User)

	constructor(io: SocketIOServer) {
		super()
		this.io = io
		this.setupSocketHandlers()
	}

	private setupSocketHandlers(): void {
		this.io.use(async (socket: AuthenticatedSocket, next) => {
			try {
				const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "")

				if (!token) {
					return next(new Error("Authentication token required"))
				}

				const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
				const user = await this.userRepository.findOne({ where: { id: decoded.userId } })

				if (!user || !user.isActive) {
					return next(new Error("Invalid or inactive user"))
				}

				socket.user = {
					id: user.id,
					username: user.username,
					email: user.email,
					role: user.role,
				}

				next()
			} catch (error) {
				next(new Error("Authentication failed"))
			}
		})

		this.io.on("connection", (socket: AuthenticatedSocket) => {
			this.handleConnection(socket)
		})
	}

	private handleConnection(socket: AuthenticatedSocket): void {
		if (!socket.user) {
			socket.disconnect()
			return
		}

		console.log(`User ${socket.user.username} connected: ${socket.id}`)
		this.authenticatedSockets.set(socket.id, socket)

		// Join user-specific room
		socket.join(`user:${socket.user.id}`)

		// Handle repository joining
		socket.on("join-repository", (repositoryId: string) => {
			socket.join(`repo:${repositoryId}`)
			console.log(`User ${socket.user?.username} joined repository ${repositoryId}`)

			this.emit("user-joined-repository", {
				userId: socket.user?.id,
				repositoryId,
				socketId: socket.id,
			})
		})

		// Handle repository leaving
		socket.on("leave-repository", (repositoryId: string) => {
			socket.leave(`repo:${repositoryId}`)
			console.log(`User ${socket.user?.username} left repository ${repositoryId}`)

			this.emit("user-left-repository", {
				userId: socket.user?.id,
				repositoryId,
				socketId: socket.id,
			})
		})

		// Handle task joining
		socket.on("join-task", (taskId: string) => {
			socket.join(`task:${taskId}`)
			console.log(`User ${socket.user?.username} joined task ${taskId}`)
		})

		// Handle task leaving
		socket.on("leave-task", (taskId: string) => {
			socket.leave(`task:${taskId}`)
			console.log(`User ${socket.user?.username} left task ${taskId}`)
		})

		// Handle terminal joining
		socket.on("join-terminal", (terminalId: string) => {
			socket.join(`terminal:${terminalId}`)
			console.log(`User ${socket.user?.username} joined terminal ${terminalId}`)
		})

		// Handle terminal leaving
		socket.on("leave-terminal", (terminalId: string) => {
			socket.leave(`terminal:${terminalId}`)
			console.log(`User ${socket.user?.username} left terminal ${terminalId}`)
		})

		// Handle user message
		socket.on("user-message", (data: { taskId: string; content: string; images?: string[]; files?: string[] }) => {
			this.emit("user-message", {
				...data,
				userId: socket.user?.id,
				socketId: socket.id,
			})
		})

		// Handle terminal input
		socket.on("terminal-input", (data: { terminalId: string; input: string }) => {
			this.emit("terminal-input", {
				...data,
				userId: socket.user?.id,
				socketId: socket.id,
			})
		})

		// Handle terminal resize
		socket.on("terminal-resize", (data: { terminalId: string; cols: number; rows: number }) => {
			this.emit("terminal-resize", {
				...data,
				userId: socket.user?.id,
				socketId: socket.id,
			})
		})

		// Handle disconnect
		socket.on("disconnect", (reason) => {
			console.log(`User ${socket.user?.username} disconnected: ${reason}`)
			this.authenticatedSockets.delete(socket.id)

			this.emit("user-disconnected", {
				userId: socket.user?.id,
				socketId: socket.id,
				reason,
			})
		})

		// Send welcome message
		socket.emit("connected", {
			message: "Connected to Cline Web Server",
			user: socket.user,
			timestamp: new Date(),
		})
	}

	// Emit to specific user
	emitToUser(userId: string, event: string, data: any): void {
		this.io.to(`user:${userId}`).emit(event, data)
	}

	// Emit to repository room
	emitToRepository(repositoryId: string, event: string, data: any): void {
		this.io.to(`repo:${repositoryId}`).emit(event, data)
	}

	// Emit to task room
	emitToTask(taskId: string, event: string, data: any): void {
		this.io.to(`task:${taskId}`).emit(event, data)
	}

	// Emit to terminal room
	emitToTerminal(terminalId: string, event: string, data: any): void {
		this.io.to(`terminal:${terminalId}`).emit(event, data)
	}

	// Emit to all connected users
	emitToAll(event: string, data: any): void {
		this.io.emit(event, data)
	}

	// Get connected users count
	getConnectedUsersCount(): number {
		return this.authenticatedSockets.size
	}

	// Get connected users in repository
	async getRepositoryUsers(repositoryId: string): Promise<SocketUser[]> {
		const sockets = await this.io.in(`repo:${repositoryId}`).fetchSockets()
		return sockets.map((socket) => (socket as AuthenticatedSocket).user).filter((user) => user !== undefined) as SocketUser[]
	}

	// Check if user is connected
	isUserConnected(userId: string): boolean {
		return Array.from(this.authenticatedSockets.values()).some((socket) => socket.user?.id === userId)
	}

	// Get user's socket
	getUserSocket(userId: string): AuthenticatedSocket | undefined {
		return Array.from(this.authenticatedSockets.values()).find((socket) => socket.user?.id === userId)
	}

	// Disconnect user
	disconnectUser(userId: string, reason?: string): void {
		const socket = this.getUserSocket(userId)
		if (socket) {
			socket.disconnect(true)
			console.log(`Forcibly disconnected user ${socket.user?.username}: ${reason || "No reason provided"}`)
		}
	}

	// Send notification to user
	sendNotification(
		userId: string,
		notification: {
			type: "info" | "success" | "warning" | "error"
			title: string
			message: string
			data?: any
		},
	): void {
		this.emitToUser(userId, "notification", {
			...notification,
			timestamp: new Date(),
		})
	}

	// Send system message
	sendSystemMessage(
		repositoryId: string,
		message: {
			type: "info" | "warning" | "error"
			content: string
			data?: any
		},
	): void {
		this.emitToRepository(repositoryId, "system-message", {
			...message,
			timestamp: new Date(),
		})
	}

	// Handle task events
	handleTaskEvent(taskId: string, event: string, data: any): void {
		this.emitToTask(taskId, `task:${event}`, {
			taskId,
			...data,
			timestamp: new Date(),
		})
	}

	// Handle file change events
	handleFileChange(
		repositoryId: string,
		change: {
			type: "add" | "change" | "unlink" | "addDir" | "unlinkDir"
			path: string
			stats?: any
		},
	): void {
		this.emitToRepository(repositoryId, "file-change", {
			repositoryId,
			...change,
			timestamp: new Date(),
		})
	}

	// Handle terminal events
	handleTerminalEvent(terminalId: string, event: string, data: any): void {
		this.emitToTerminal(terminalId, `terminal:${event}`, {
			terminalId,
			...data,
			timestamp: new Date(),
		})
	}

	// Cleanup
	async cleanup(): Promise<void> {
		// Disconnect all sockets
		this.io.disconnectSockets(true)
		this.authenticatedSockets.clear()
	}
}
