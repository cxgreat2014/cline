import { create } from "zustand"
import { Socket } from "socket.io-client"

interface SocketState {
	socket: Socket | null
	isConnected: boolean
	connectionError: string | null
	reconnectAttempts: number
}

interface SocketActions {
	connect: (socket: Socket) => void
	disconnect: () => void
	setConnectionError: (error: string | null) => void
	incrementReconnectAttempts: () => void
	resetReconnectAttempts: () => void
}

export const useSocketStore = create<SocketState & SocketActions>((set, get) => ({
	// State
	socket: null,
	isConnected: false,
	connectionError: null,
	reconnectAttempts: 0,

	// Actions
	connect: (socket: Socket) => {
		const currentSocket = get().socket

		// Disconnect existing socket if any
		if (currentSocket) {
			currentSocket.disconnect()
		}

		// Set up event listeners
		socket.on("connect", () => {
			console.log("Socket connected:", socket.id)
			set({
				isConnected: true,
				connectionError: null,
				reconnectAttempts: 0,
			})
		})

		socket.on("disconnect", (reason) => {
			console.log("Socket disconnected:", reason)
			set({ isConnected: false })
		})

		socket.on("connect_error", (error) => {
			console.error("Socket connection error:", error)
			set({
				connectionError: error.message,
				isConnected: false,
			})
			get().incrementReconnectAttempts()
		})

		socket.on("reconnect", (attemptNumber) => {
			console.log("Socket reconnected after", attemptNumber, "attempts")
			set({
				isConnected: true,
				connectionError: null,
				reconnectAttempts: 0,
			})
		})

		socket.on("reconnect_error", (error) => {
			console.error("Socket reconnection error:", error)
			set({ connectionError: error.message })
			get().incrementReconnectAttempts()
		})

		set({ socket })
	},

	disconnect: () => {
		const { socket } = get()
		if (socket) {
			socket.disconnect()
			set({
				socket: null,
				isConnected: false,
				connectionError: null,
				reconnectAttempts: 0,
			})
		}
	},

	setConnectionError: (error: string | null) => {
		set({ connectionError: error })
	},

	incrementReconnectAttempts: () => {
		set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 }))
	},

	resetReconnectAttempts: () => {
		set({ reconnectAttempts: 0 })
	},
}))

// Socket event types
export interface SocketEvents {
	// Connection events
	connected: { message: string; user: any; timestamp: string }

	// Task events
	"task:message": { taskId: string; type: string; content: string; timestamp: string }
	"task:status": { taskId: string; status: string; timestamp: string }
	"task:tool_use": { taskId: string; toolName: string; parameters: any; timestamp: string }
	"task:tool_result": { taskId: string; toolName: string; result: any; timestamp: string }
	"task:error": { taskId: string; error: string; timestamp: string }

	// File events
	"file-change": { repositoryId: string; type: string; path: string; timestamp: string }

	// Terminal events
	"terminal:output": { terminalId: string; data: string; timestamp: string }
	"terminal:exit": { terminalId: string; exitCode: number; signal?: string; timestamp: string }
	"terminal:created": { terminalId: string; repositoryId: string; timestamp: string }
	"terminal:closed": { terminalId: string; timestamp: string }

	// System events
	"system-message": { type: string; content: string; timestamp: string }
	notification: { type: string; title: string; message: string; timestamp: string }
}

// Socket emit types
export interface SocketEmits {
	// Room management
	"join-repository": string
	"leave-repository": string
	"join-task": string
	"leave-task": string
	"join-terminal": string
	"leave-terminal": string

	// User actions
	"user-message": { taskId: string; content: string; images?: string[]; files?: string[] }
	"terminal-input": { terminalId: string; input: string }
	"terminal-resize": { terminalId: string; cols: number; rows: number }
}
