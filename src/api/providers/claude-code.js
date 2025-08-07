var __decorate =
	(this && this.__decorate) ||
	function (decorators, target, key, desc) {
		var c = arguments.length,
			r = c < 3 ? target : desc === null ? (desc = Object.getOwnPropertyDescriptor(target, key)) : desc,
			d
		if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
			r = Reflect.decorate(decorators, target, key, desc)
		else
			for (var i = decorators.length - 1; i >= 0; i--)
				if ((d = decorators[i])) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r
		return (c > 3 && r && Object.defineProperty(target, key, r), r)
	}
import { claudeCodeDefaultModelId, claudeCodeModels } from "@/shared/api"
import { withRetry } from "../retry"
import { runClaudeCode } from "@/integrations/claude-code/run"
import { filterMessagesForClaudeCode } from "@/integrations/claude-code/message-filter"
export class ClaudeCodeHandler {
	options
	constructor(options) {
		this.options = options
	}
	async *createMessage(systemPrompt, messages) {
		// Filter out image blocks since Claude Code doesn't support them
		const filteredMessages = filterMessagesForClaudeCode(messages)
		const claudeProcess = runClaudeCode({
			systemPrompt,
			messages: filteredMessages,
			path: this.options.claudeCodePath,
			modelId: this.getModel().id,
			thinkingBudgetTokens: this.options.thinkingBudgetTokens,
		})
		// Usage is included with assistant messages,
		// but cost is included in the result chunk
		let usage = {
			type: "usage",
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		}
		let isPaidUsage = true
		for await (const chunk of claudeProcess) {
			if (typeof chunk === "string") {
				yield {
					type: "text",
					text: chunk,
				}
				continue
			}
			if (chunk.type === "system" && chunk.subtype === "init") {
				// Based on my tests, subscription usage sets the `apiKeySource` to "none"
				isPaidUsage = chunk.apiKeySource !== "none"
				continue
			}
			if (chunk.type === "assistant" && "message" in chunk) {
				const message = chunk.message
				if (message.stop_reason !== null) {
					const content = "text" in message.content[0] ? message.content[0] : undefined
					const isError = content && content.text.startsWith(`API Error`)
					if (isError) {
						// Error messages are formatted as: `API Error: <<status code>> <<json>>`
						const errorMessageStart = content.text.indexOf("{")
						const errorMessage = content.text.slice(errorMessageStart)
						const error = this.attemptParse(errorMessage)
						if (!error) {
							throw new Error(content.text)
						}
						if (error.error.message.includes("Invalid model name")) {
							throw new Error(
								content.text +
									`\n\nAPI keys and subscription plans allow different models. Make sure the selected model is included in your plan.`,
							)
						}
						throw new Error(errorMessage)
					}
				}
				for (const content of message.content) {
					switch (content.type) {
						case "text":
							yield {
								type: "text",
								text: content.text,
							}
							break
						case "thinking":
							yield {
								type: "reasoning",
								reasoning: content.thinking || "",
							}
							break
						case "redacted_thinking":
							yield {
								type: "reasoning",
								reasoning: "[Redacted thinking block]",
							}
							break
						case "tool_use":
							console.error(`tool_use is not supported yet. Received: ${JSON.stringify(content)}`)
							break
					}
				}
				usage.inputTokens += message.usage.input_tokens
				usage.outputTokens += message.usage.output_tokens
				usage.cacheReadTokens = (usage.cacheReadTokens || 0) + (message.usage.cache_read_input_tokens || 0)
				usage.cacheWriteTokens = (usage.cacheWriteTokens || 0) + (message.usage.cache_creation_input_tokens || 0)
				continue
			}
			if (chunk.type === "result" && "result" in chunk) {
				usage.totalCost = isPaidUsage ? chunk.total_cost_usd : 0
				yield usage
			}
		}
	}
	attemptParse(str) {
		try {
			return JSON.parse(str)
		} catch (err) {
			return null
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in claudeCodeModels) {
			const id = modelId
			return { id, info: claudeCodeModels[id] }
		}
		return {
			id: claudeCodeDefaultModelId,
			info: claudeCodeModels[claudeCodeDefaultModelId],
		}
	}
}
__decorate(
	[
		withRetry({
			maxRetries: 4,
			baseDelay: 2000,
			maxDelay: 15000,
		}),
	],
	ClaudeCodeHandler.prototype,
	"createMessage",
	null,
)
//# sourceMappingURL=claude-code.js.map
