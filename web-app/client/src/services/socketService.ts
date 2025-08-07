import { io, Socket } from "socket.io-client"
import { SocketEvents, SocketEmits } from "@store/socketStore"

class SocketService {
	private socket: Socket | null = null

	connect(token: string): Socket {
		if (this.socket?.connected) {
			return this.socket
		}

		const wsUrl = import.meta.env?.VITE_WS_URL || "ws://localhost:8000"

		this.socket = io(wsUrl, {
			auth: {
				token,
			},
			transports: ["websocket", "polling"],
			timeout: 20000,
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			// maxReconnectionAttempts: 5 // This option doesn't exist, using reconnectionAttempts instead,
		})

		return this.socket
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect()
			this.socket = null
		}
	}

	emit<K extends keyof SocketEmits>(event: K, data: SocketEmits[K]): void {
		if (this.socket?.connected) {
			this.socket.emit(event, data)
		} else {
			console.warn(`Cannot emit ${String(event)}: socket not connected`)
		}
	}

	on<K extends keyof SocketEvents>(event: K, callback: (data: SocketEvents[K]) => void): void {
		if (this.socket) {
			this.socket.on(event as string, callback as any)
		}
	}

	off<K extends keyof SocketEvents>(event: K, callback?: (data: SocketEvents[K]) => void): void {
		if (this.socket) {
			if (callback) {
				this.socket.off(event as string, callback as any)
			} else {
				this.socket.off(event as string)
			}
		}
	}

	// Convenience methods for common operations
	joinRepository(repositoryId: string): void {
		this.emit("join-repository", repositoryId)
	}

	leaveRepository(repositoryId: string): void {
		this.emit("leave-repository", repositoryId)
	}

	joinTask(taskId: string): void {
		this.emit("join-task", taskId)
	}

	leaveTask(taskId: string): void {
		this.emit("leave-task", taskId)
	}

	joinTerminal(terminalId: string): void {
		this.emit("join-terminal", terminalId)
	}

	leaveTerminal(terminalId: string): void {
		this.emit("leave-terminal", terminalId)
	}

	sendUserMessage(taskId: string, content: string, images?: string[], files?: string[]): void {
		this.emit("user-message", { taskId, content, images, files })
	}

	sendTerminalInput(terminalId: string, input: string): void {
		this.emit("terminal-input", { terminalId, input })
	}

	resizeTerminal(terminalId: string, cols: number, rows: number): void {
		this.emit("terminal-resize", { terminalId, cols, rows })
	}

	isConnected(): boolean {
		return this.socket?.connected || false
	}

	getSocket(): Socket | null {
		return this.socket
	}
}

export const socketService = new SocketService()

// Initialize socket connection
export const initializeSocket = (): Socket => {
	// Get token from localStorage
	const authData = localStorage.getItem("cline-auth")
	if (!authData) {
		throw new Error("No authentication token found")
	}

	try {
		const { state } = JSON.parse(authData)
		if (!state?.token) {
			throw new Error("No authentication token found")
		}

		return socketService.connect(state.token)
	} catch (error) {
		console.error("Failed to initialize socket:", error)
		throw error
	}
}
