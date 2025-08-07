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
import { huggingFaceDefaultModelId, huggingFaceModels } from "@shared/api"
import { calculateApiCostOpenAI } from "../../utils/cost"
import { convertToOpenAiMessages } from "../transform/openai-format"
export class HuggingFaceHandler {
	options
	client
	cachedModel
	constructor(options) {
		this.options = options
	}
	ensureClient() {
		if (!this.client) {
			if (!this.options.huggingFaceApiKey) {
				throw new Error("Hugging Face API key is required")
			}
			try {
				this.client = new OpenAI({
					baseURL: "https://router.huggingface.co/v1",
					apiKey: this.options.huggingFaceApiKey,
					defaultHeaders: {
						"User-Agent": "Cline/1.0",
					},
				})
			} catch (error) {
				throw new Error(`Error creating Hugging Face client: ${error.message}`)
			}
		}
		return this.client
	}
	async *yieldUsage(info, usage) {
		if (!usage) {
			return
		}
		const inputTokens = usage.prompt_tokens || 0
		const outputTokens = usage.completion_tokens || 0
		const totalCost = calculateApiCostOpenAI(info, inputTokens, outputTokens)
		const usageData = {
			type: "usage",
			inputTokens: inputTokens,
			outputTokens: outputTokens,
			cacheWriteTokens: 0,
			cacheReadTokens: 0,
			totalCost: totalCost,
		}
		yield usageData
	}
	async *createMessage(systemPrompt, messages) {
		try {
			const client = this.ensureClient()
			const model = this.getModel()
			const openAiMessages = [{ role: "system", content: systemPrompt }, ...convertToOpenAiMessages(messages)]
			const requestParams = {
				model: model.id,
				max_tokens: model.info.maxTokens,
				messages: openAiMessages,
				stream: true,
				stream_options: { include_usage: true },
				temperature: 0,
			}
			const stream = await client.chat.completions.create(requestParams)
			let chunkCount = 0
			let totalContent = ""
			for await (const chunk of stream) {
				chunkCount++
				const delta = chunk.choices[0]?.delta
				if (delta?.content) {
					totalContent += delta.content
					yield {
						type: "text",
						text: delta.content,
					}
				}
				if (chunk.usage) {
					yield* this.yieldUsage(model.info, chunk.usage)
				}
			}
		} catch (error) {
			throw error
		}
	}
	getModel() {
		// Return cached model if available
		if (this.cachedModel) {
			return this.cachedModel
		}
		const modelId = this.options.huggingFaceModelId
		// List all available models for debugging
		const availableModels = Object.keys(huggingFaceModels)
		let result
		if (modelId && modelId in huggingFaceModels) {
			const id = modelId
			const modelInfo = huggingFaceModels[id]
			result = { id, info: modelInfo }
		} else {
			const defaultInfo = huggingFaceModels[huggingFaceDefaultModelId]
			result = {
				id: huggingFaceDefaultModelId,
				info: defaultInfo,
			}
		}
		// Cache the result for future calls
		this.cachedModel = result
		return result
	}
}
__decorate([withRetry()], HuggingFaceHandler.prototype, "createMessage", null)
//# sourceMappingURL=huggingface.js.map
