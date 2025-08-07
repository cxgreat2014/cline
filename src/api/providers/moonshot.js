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
import OpenAI from "openai"
import { withRetry } from "../retry"
import { convertToOpenAiMessages } from "../transform/openai-format"
import { moonshotModels, moonshotDefaultModelId } from "@/shared/api"
export class MoonshotHandler {
	options
	client
	constructor(options) {
		this.options = options
	}
	ensureClient() {
		if (!this.client) {
			if (!this.options.moonshotApiKey) {
				throw new Error("Moonshot API key is required")
			}
			try {
				this.client = new OpenAI({
					baseURL:
						this.options.moonshotApiLine === "china" ? "https://api.moonshot.cn/v1" : "https://api.moonshot.ai/v1",
					apiKey: this.options.moonshotApiKey,
				})
			} catch (error) {
				throw new Error(`Error creating Moonshot client: ${error.message}`)
			}
		}
		return this.client
	}
	async *createMessage(systemPrompt, messages) {
		const client = this.ensureClient()
		const model = this.getModel()
		const openAiMessages = [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)]
		const stream = await client.chat.completions.create({
			model: model.id,
			messages: openAiMessages,
			temperature: 0,
			stream: true,
			stream_options: { include_usage: true },
		})
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}
			if (delta && "reasoning_content" in delta && delta.reasoning_content) {
				yield {
					type: "reasoning",
					reasoning: delta.reasoning_content || "",
				}
			}
			if (chunk.usage) {
				yield {
					type: "usage",
					inputTokens: chunk.usage.prompt_tokens || 0,
					outputTokens: chunk.usage.completion_tokens || 0,
				}
			}
		}
	}
	getModel() {
		const modelId = this.options.apiModelId
		if (modelId && modelId in moonshotModels) {
			const id = modelId
			return { id, info: moonshotModels[id] }
		}
		return { id: moonshotDefaultModelId, info: moonshotModels[moonshotDefaultModelId] }
	}
}
__decorate([withRetry()], MoonshotHandler.prototype, "createMessage", null)
//# sourceMappingURL=moonshot.js.map
