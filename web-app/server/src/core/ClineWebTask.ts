import { EventEmitter } from "events"
import path from "path"
import { Repository } from "@models/Repository"
import { Task, TaskStatus, TaskMode } from "@models/Task"
import { User } from "@models/User"
import { FileManager } from "@services/FileManager"
import { TerminalManager } from "@services/TerminalManager"
import { SocketService } from "@services/SocketService"
import { ApiHandler } from "./ApiHandler"
import { ToolExecutor } from "./ToolExecutor"
import { PromptBuilder } from "./PromptBuilder"

export interface TaskContext {
	repository: Repository
	user: User
	task: Task
	workingDirectory: string
}

export interface UserContent {
	type: "text" | "image"
	text?: string
	source?: {
		type: "base64"
		media_type: string
		data: string
	}
}

export class ClineWebTask extends EventEmitter {
	private context: TaskContext
	private fileManager: FileManager
	private terminalManager: TerminalManager
	private socketService: SocketService
	private apiHandler: ApiHandler
	private toolExecutor: ToolExecutor
	private promptBuilder: PromptBuilder

	private isRunning = false
	private shouldAbort = false
	private conversationHistory: any[] = []
	private assistantMessageContent: any[] = []

	constructor(context: TaskContext, fileManager: FileManager, terminalManager: TerminalManager, socketService: SocketService) {
		super()
		this.context = context
		this.fileManager = fileManager
		this.terminalManager = terminalManager
		this.socketService = socketService

		// Initialize core components
		this.apiHandler = new ApiHandler()
		this.toolExecutor = new ToolExecutor(this)
		this.promptBuilder = new PromptBuilder(context)
	}

	async initialize(userInput: string, images?: string[]): Promise<void> {
		try {
			this.emit("status", { status: "initializing" })

			// Update task status
			this.context.task.start()

			// Build initial user content
			const userContent: UserContent[] = [
				{
					type: "text",
					text: `<task>\n${userInput}\n</task>`,
				},
			]

			// Add images if provided
			if (images && images.length > 0) {
				for (const image of images) {
					userContent.push({
						type: "image",
						source: {
							type: "base64",
							media_type: "image/jpeg", // 需要根据实际格式检测
							data: image,
						},
					})
				}
			}

			// Start task execution loop
			await this.initiateTaskLoop(userContent)
		} catch (error) {
			console.error("Failed to initialize task:", error)
			this.context.task.fail(error instanceof Error ? error.message : String(error))
			this.emit("error", error)
		}
	}

	private async initiateTaskLoop(userContent: UserContent[]): Promise<void> {
		this.isRunning = true
		this.emit("status", { status: "running" })

		try {
			while (!this.shouldAbort && this.isRunning) {
				// Build system prompt
				const systemPrompt = await this.promptBuilder.buildSystemPrompt()

				// Make API request
				const response = await this.makeApiRequest(systemPrompt, userContent)

				// Process response
				const shouldContinue = await this.processApiResponse(response)

				if (!shouldContinue) {
					break
				}

				// Wait for next user input or tool execution
				userContent = await this.waitForNextInput()
			}

			if (!this.shouldAbort) {
				this.context.task.complete()
				this.emit("status", { status: "completed" })
			}
		} catch (error) {
			console.error("Task execution error:", error)
			this.context.task.fail(error instanceof Error ? error.message : String(error))
			this.emit("error", error)
		} finally {
			this.isRunning = false
		}
	}

	private async makeApiRequest(systemPrompt: string, userContent: UserContent[]): Promise<any> {
		// Build conversation history
		const messages = this.buildConversationMessages(userContent)

		// Make API call
		const response = await this.apiHandler.createMessage(systemPrompt, messages)

		// Add to conversation history
		this.conversationHistory.push({
			role: "user",
			content: userContent,
		})

		return response
	}

	private async processApiResponse(response: any): Promise<boolean> {
		// Parse assistant message content
		this.assistantMessageContent = this.parseAssistantMessage(response.content)

		// Process each content block
		for (const block of this.assistantMessageContent) {
			if (block.type === "text") {
				await this.handleTextBlock(block)
			} else if (block.type === "tool_use") {
				await this.handleToolUseBlock(block)
			}
		}

		// Check if task is complete
		return this.shouldContinueExecution()
	}

	private async handleTextBlock(block: any): Promise<void> {
		// Send text message to client
		this.socketService.emitToRepository(this.context.repository.id, "task:message", {
			taskId: this.context.task.id,
			type: "assistant",
			content: block.text,
			timestamp: new Date(),
		})
	}

	private async handleToolUseBlock(block: any): Promise<void> {
		try {
			// Send tool use notification
			this.socketService.emitToRepository(this.context.repository.id, "task:tool_use", {
				taskId: this.context.task.id,
				toolName: block.name,
				parameters: block.input,
				timestamp: new Date(),
			})

			// Execute tool
			const result = await this.toolExecutor.executeTool(block.name, block.input)

			// Send tool result
			this.socketService.emitToRepository(this.context.repository.id, "task:tool_result", {
				taskId: this.context.task.id,
				toolName: block.name,
				result,
				timestamp: new Date(),
			})

			// Add tool result to conversation
			this.conversationHistory.push({
				role: "assistant",
				content: this.assistantMessageContent,
			})

			this.conversationHistory.push({
				role: "user",
				content: [
					{
						type: "tool_result",
						tool_use_id: block.id,
						content: result,
					},
				],
			})
		} catch (error) {
			console.error("Tool execution error:", error)

			// Send error to client
			this.socketService.emitToRepository(this.context.repository.id, "task:error", {
				taskId: this.context.task.id,
				error: error instanceof Error ? error.message : String(error),
				timestamp: new Date(),
			})
		}
	}

	private parseAssistantMessage(content: string): any[] {
		// 这里需要实现类似原 Cline 的消息解析逻辑
		// 解析 XML 格式的工具调用和文本内容
		const blocks: any[] = []

		// 简化的解析逻辑，实际需要更复杂的 XML 解析
		const toolUseRegex = /<(\w+)>(.*?)<\/\1>/gs
		let lastIndex = 0
		let match

		while ((match = toolUseRegex.exec(content)) !== null) {
			// Add text before tool use
			if (match.index > lastIndex) {
				const textContent = content.slice(lastIndex, match.index).trim()
				if (textContent) {
					blocks.push({
						type: "text",
						text: textContent,
					})
				}
			}

			// Add tool use
			blocks.push({
				type: "tool_use",
				id: `tool_${Date.now()}_${Math.random()}`,
				name: match[1],
				input: this.parseToolParameters(match[2]),
			})

			lastIndex = match.index + match[0].length
		}

		// Add remaining text
		if (lastIndex < content.length) {
			const textContent = content.slice(lastIndex).trim()
			if (textContent) {
				blocks.push({
					type: "text",
					text: textContent,
				})
			}
		}

		return blocks
	}

	private parseToolParameters(paramString: string): any {
		// 解析工具参数
		// 这里需要实现更复杂的参数解析逻辑
		try {
			return JSON.parse(paramString)
		} catch {
			return { content: paramString }
		}
	}

	private buildConversationMessages(userContent: UserContent[]): any[] {
		const messages = [...this.conversationHistory]

		if (userContent.length > 0) {
			messages.push({
				role: "user",
				content: userContent,
			})
		}

		return messages
	}

	private async waitForNextInput(): Promise<UserContent[]> {
		// 等待用户输入或工具执行完成
		return new Promise((resolve) => {
			// 如果有待处理的工具结果，直接返回
			if (this.hasToolResults()) {
				resolve(this.getToolResults())
			} else {
				// 等待用户输入
				this.once("user_input", (userContent: UserContent[]) => {
					resolve(userContent)
				})
			}
		})
	}

	private hasToolResults(): boolean {
		// 检查是否有待处理的工具结果
		return false // 简化实现
	}

	private getToolResults(): UserContent[] {
		// 获取工具执行结果
		return [] // 简化实现
	}

	private shouldContinueExecution(): boolean {
		// 检查是否应该继续执行
		const hasToolUse = this.assistantMessageContent.some((block) => block.type === "tool_use")
		const hasCompletionSignal = this.assistantMessageContent.some(
			(block) => block.type === "text" && block.text.includes("task completed"),
		)

		return hasToolUse && !hasCompletionSignal
	}

	// Public methods
	async processUserMessage(message: string, images?: string[]): Promise<void> {
		const userContent: UserContent[] = [
			{
				type: "text",
				text: message,
			},
		]

		if (images) {
			for (const image of images) {
				userContent.push({
					type: "image",
					source: {
						type: "base64",
						media_type: "image/jpeg",
						data: image,
					},
				})
			}
		}

		this.emit("user_input", userContent)
	}

	abort(): void {
		this.shouldAbort = true
		this.context.task.cancel()
		this.emit("status", { status: "cancelled" })
	}

	getContext(): TaskContext {
		return this.context
	}

	getFileManager(): FileManager {
		return this.fileManager
	}

	getTerminalManager(): TerminalManager {
		return this.terminalManager
	}
}
