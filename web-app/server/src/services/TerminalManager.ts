import * as pty from "node-pty"
import { EventEmitter } from "events"
import { Terminal, TerminalStatus } from "@models/Terminal"
import { Repository } from "@models/Repository"
import { User } from "@models/User"
import { AppDataSource } from "@/config/database"

export interface TerminalSession {
	id: string
	pty: pty.IPty
	terminal: Terminal
	lastActivity: Date
}

export interface TerminalOptions {
	cols?: number
	rows?: number
	shell?: string
	env?: Record<string, string>
}

export class TerminalManager extends EventEmitter {
	private sessions = new Map<string, TerminalSession>()
	private terminalRepository = AppDataSource.getRepository(Terminal)
	private cleanupInterval: NodeJS.Timeout

	constructor() {
		super()

		// Cleanup inactive terminals every 5 minutes
		this.cleanupInterval = setInterval(
			() => {
				this.cleanupInactiveSessions()
			},
			5 * 60 * 1000,
		)
	}

	async createTerminal(repository: Repository, user: User, options: TerminalOptions = {}): Promise<string> {
		const terminalId = `terminal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

		// Default options
		const defaultOptions = {
			cols: options.cols || 80,
			rows: options.rows || 30,
			shell: options.shell || (process.platform === "win32" ? "cmd.exe" : "bash"),
			env: {
				...process.env,
				...options.env,
			},
		}

		try {
			// Create PTY process
			const ptyProcess = pty.spawn(defaultOptions.shell, [], {
				name: "xterm-color",
				cols: defaultOptions.cols,
				rows: defaultOptions.rows,
				cwd: repository.path,
				env: defaultOptions.env,
			})

			// Create database record
			const terminal = new Terminal()
			terminal.sessionId = terminalId
			terminal.name = `Terminal - ${repository.name}`
			terminal.repositoryId = repository.id
			terminal.userId = user.id
			terminal.workingDirectory = repository.path
			terminal.environment = defaultOptions.env
			terminal.settings = {
				cols: defaultOptions.cols,
				rows: defaultOptions.rows,
				shell: defaultOptions.shell,
				encoding: "utf8",
			}
			terminal.status = TerminalStatus.ACTIVE
			terminal.lastActivityAt = new Date()

			await this.terminalRepository.save(terminal)

			// Create session
			const session: TerminalSession = {
				id: terminalId,
				pty: ptyProcess,
				terminal,
				lastActivity: new Date(),
			}

			// Set up event handlers
			ptyProcess.onData((data) => {
				session.lastActivity = new Date()
				terminal.updateActivity()
				terminal.lastOutput = data

				this.emit("output", {
					terminalId,
					data,
					timestamp: new Date(),
				})
			})

			ptyProcess.onExit((exitCode, signal) => {
				this.emit("exit", {
					terminalId,
					exitCode,
					signal,
					timestamp: new Date(),
				})

				this.closeTerminal(terminalId)
			})

			this.sessions.set(terminalId, session)

			this.emit("created", {
				terminalId,
				repositoryId: repository.id,
				userId: user.id,
				timestamp: new Date(),
			})

			return terminalId
		} catch (error) {
			throw new Error(`Failed to create terminal: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async writeToTerminal(terminalId: string, data: string): Promise<void> {
		const session = this.sessions.get(terminalId)
		if (!session) {
			throw new Error(`Terminal ${terminalId} not found`)
		}

		if (!session.terminal.isActive()) {
			throw new Error(`Terminal ${terminalId} is not active`)
		}

		try {
			session.pty.write(data)
			session.lastActivity = new Date()
			session.terminal.updateActivity()

			// Save updated activity time
			await this.terminalRepository.save(session.terminal)

			this.emit("input", {
				terminalId,
				data,
				timestamp: new Date(),
			})
		} catch (error) {
			throw new Error(`Failed to write to terminal: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async resizeTerminal(terminalId: string, cols: number, rows: number): Promise<void> {
		const session = this.sessions.get(terminalId)
		if (!session) {
			throw new Error(`Terminal ${terminalId} not found`)
		}

		try {
			session.pty.resize(cols, rows)

			// Update settings in database
			session.terminal.settings = {
				...session.terminal.settings,
				cols,
				rows,
			}
			await this.terminalRepository.save(session.terminal)

			this.emit("resized", {
				terminalId,
				cols,
				rows,
				timestamp: new Date(),
			})
		} catch (error) {
			throw new Error(`Failed to resize terminal: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async closeTerminal(terminalId: string): Promise<void> {
		const session = this.sessions.get(terminalId)
		if (!session) {
			return // Already closed or doesn't exist
		}

		try {
			// Kill the PTY process
			session.pty.kill()

			// Update database record
			session.terminal.close()
			await this.terminalRepository.save(session.terminal)

			// Remove from active sessions
			this.sessions.delete(terminalId)

			this.emit("closed", {
				terminalId,
				timestamp: new Date(),
			})
		} catch (error) {
			console.error(`Error closing terminal ${terminalId}:`, error)
		}
	}

	async getTerminal(terminalId: string): Promise<Terminal | null> {
		return await this.terminalRepository.findOne({
			where: { sessionId: terminalId },
			relations: ["repository", "user"],
		})
	}

	async getUserTerminals(userId: string): Promise<Terminal[]> {
		return await this.terminalRepository.find({
			where: { userId },
			relations: ["repository"],
			order: { createdAt: "DESC" },
		})
	}

	async getRepositoryTerminals(repositoryId: string): Promise<Terminal[]> {
		return await this.terminalRepository.find({
			where: { repositoryId },
			relations: ["user"],
			order: { createdAt: "DESC" },
		})
	}

	isTerminalActive(terminalId: string): boolean {
		const session = this.sessions.get(terminalId)
		return session ? session.terminal.isActive() : false
	}

	getActiveTerminalCount(): number {
		return this.sessions.size
	}

	async executeCommand(
		terminalId: string,
		command: string,
		options?: { timeout?: number },
	): Promise<{ output: string; exitCode: number }> {
		const session = this.sessions.get(terminalId)
		if (!session) {
			throw new Error(`Terminal ${terminalId} not found`)
		}

		return new Promise((resolve, reject) => {
			let output = ""
			let hasExited = false
			const timeout = options?.timeout || 30000 // 30 seconds default

			// Set up timeout
			const timeoutId = setTimeout(() => {
				if (!hasExited) {
					hasExited = true
					reject(new Error(`Command timed out after ${timeout}ms`))
				}
			}, timeout)

			// Listen for output
			const onData = (data: string) => {
				output += data
			}

			// Listen for command completion (simplified - in practice, you'd need more sophisticated detection)
			const onExit = (exitCode: number) => {
				if (!hasExited) {
					hasExited = true
					clearTimeout(timeoutId)
					session.pty.off("data", onData)
					session.pty.off("exit", onExit)
					resolve({ output, exitCode })
				}
			}

			session.pty.on("data", onData)
			session.pty.on("exit", onExit)

			// Execute the command
			session.pty.write(command + "\r")
		})
	}

	private async cleanupInactiveSessions(): Promise<void> {
		const timeoutMs = 30 * 60 * 1000 // 30 minutes
		const now = Date.now()

		for (const [terminalId, session] of this.sessions) {
			if (now - session.lastActivity.getTime() > timeoutMs) {
				console.log(`Cleaning up inactive terminal: ${terminalId}`)
				await this.closeTerminal(terminalId)
			}
		}

		// Also cleanup database records
		try {
			const expiredTerminals = await this.terminalRepository
				.createQueryBuilder("terminal")
				.where("terminal.status = :status", { status: TerminalStatus.ACTIVE })
				.andWhere("terminal.lastActivityAt < :cutoff", {
					cutoff: new Date(now - timeoutMs),
				})
				.getMany()

			for (const terminal of expiredTerminals) {
				terminal.status = TerminalStatus.INACTIVE
				await this.terminalRepository.save(terminal)
			}
		} catch (error) {
			console.error("Error cleaning up expired terminals:", error)
		}
	}

	async cleanup(): Promise<void> {
		// Clear cleanup interval
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
		}

		// Close all active sessions
		const terminalIds = Array.from(this.sessions.keys())
		for (const terminalId of terminalIds) {
			await this.closeTerminal(terminalId)
		}
	}
}
