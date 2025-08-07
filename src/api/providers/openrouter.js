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
import axios from "axios"
import { setTimeout as setTimeoutPromise } from "node:timers/promises"
import OpenAI from "openai"
import { openRouterDefaultModelId, openRouterDefaultModelInfo } from "@shared/api"
import { withRetry } from "../retry"
import { createOpenRouterStream } from "../transform/openrouter-stream"
import { shouldSkipReasoningForModel } from "@utils/model-utils"
export class OpenRouterHandler {
	options
	client
	lastGenerationId
	constructor(options) {
		this.options = options
	}
	ensureClient() {
		if (!this.client) {
			if (!this.options.openRouterApiKey) {
				throw new Error("OpenRouter API key is required")
			}
			try {
				this.client = new OpenAI({
					baseURL: "https://openrouter.ai/api/v1",
					apiKey: this.options.openRouterApiKey,
					defaultHeaders: {
						"HTTP-Referer": "https://cline.bot", // Optional, for including your app on openrouter.ai rankings.
						"X-Title": "Cline", // Optional. Shows in rankings on openrouter.ai.
					},
				})
			} catch (error) {
				throw new Error(`Error creating OpenRouter client: ${error.message}`)
			}
		}
		return this.client
	}
	async *createMessage(systemPrompt, messages) {
		const client = this.ensureClient()
		this.lastGenerationId = undefined
		const stream = await createOpenRouterStream(
			client,
			systemPrompt,
			messages,
			this.getModel(),
			this.options.reasoningEffort,
			this.options.thinkingBudgetTokens,
			this.options.openRouterProviderSorting,
		)
		let didOutputUsage = false
		for await (const chunk of stream) {
			// openrouter returns an error object instead of the openai sdk throwing an error
			// Check for error field directly on chunk
			if ("error" in chunk) {
				const error = chunk.error
				console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
				// Include metadata in the error message if available
				const metadataStr = error.metadata ? `\nMetadata: ${JSON.stringify(error.metadata, null, 2)}` : ""
				throw new Error(`OpenRouter API Error ${error.code}: ${error.message}${metadataStr}`)
			}
			// Check for error in choices[0].finish_reason
			// OpenRouter may return errors in a non-standard way within choices
			const choice = chunk.choices?.[0]
			// Use type assertion since OpenRouter uses non-standard "error" finish_reason
			if (choice?.finish_reason === "error") {
				// Use type assertion since OpenRouter adds non-standard error property
				const choiceWithError = choice
				if (choiceWithError.error) {
					const error = choiceWithError.error
					console.error(
						`OpenRouter Mid-Stream Error: ${error?.code || "Unknown"} - ${error?.message || "Unknown error"}`,
					)
					// Format error details
					const errorDetails = typeof error === "object" ? JSON.stringify(error, null, 2) : String(error)
					throw new Error(`OpenRouter Mid-Stream Error: ${errorDetails}`)
				} else {
					// Fallback if error details are not available
					throw new Error(
						`OpenRouter Mid-Stream Error: Stream terminated with error status but no error details provided`,
					)
				}
			}
			if (!this.lastGenerationId && chunk.id) {
				this.lastGenerationId = chunk.id
			}
			const delta = chunk.choices[0]?.delta
			if (delta?.content) {
				yield {
					type: "text",
					text: delta.content,
				}
			}
			// Reasoning tokens are returned separately from the content
			// Skip reasoning content for Grok 4 models since it only displays "thinking" without providing useful information
			if ("reasoning" in delta && delta.reasoning && !shouldSkipReasoningForModel(this.options.openRouterModelId)) {
				yield {
					type: "reasoning",
					// @ts-ignore-next-line
					reasoning: delta.reasoning,
				}
			}
			if (!didOutputUsage && chunk.usage) {
				let modelId = this.options.openRouterModelId
				if (modelId && modelId.includes("gemini")) {
					yield {
						type: "usage",
						cacheWriteTokens: 0,
						cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens || 0,
						inputTokens: (chunk.usage.prompt_tokens || 0) - (chunk.usage.prompt_tokens_details?.cached_tokens || 0),
						outputTokens: chunk.usage.completion_tokens || 0,
						// @ts-ignore-next-line
						totalCost: (chunk.usage.cost || 0) + (chunk.usage.cost_details?.upstream_inference_cost || 0),
					}
				} else {
					yield {
						type: "usage",
						cacheWriteTokens: 0,
						cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens || 0,
						inputTokens: chunk.usage.prompt_tokens || 0,
						outputTokens: chunk.usage.completion_tokens || 0,
						// @ts-ignore-next-line
						totalCost: (chunk.usage.cost || 0) + (chunk.usage.cost_details?.upstream_inference_cost || 0),
					}
				}
				didOutputUsage = true
			}
		}
		// Fallback to generation endpoint if usage chunk not returned
		if (!didOutputUsage) {
			const apiStreamUsage = await this.getApiStreamUsage()
			if (apiStreamUsage) {
				yield apiStreamUsage
			}
		}
	}
	async getApiStreamUsage() {
		if (this.lastGenerationId) {
			await setTimeoutPromise(500) // FIXME: necessary delay to ensure generation endpoint is ready
			try {
				const generationIterator = this.fetchGenerationDetails(this.lastGenerationId)
				const generation = (await generationIterator.next()).value
				// console.log("OpenRouter generation details:", generation)
				let modelId = this.options.openRouterModelId
				if (modelId && modelId.includes("gemini")) {
					return {
						type: "usage",
						cacheWriteTokens: 0,
						cacheReadTokens: generation?.native_tokens_cached || 0,
						// openrouter generation endpoint fails often
						inputTokens: (generation?.native_tokens_prompt || 0) - (generation?.native_tokens_cached || 0),
						outputTokens: generation?.native_tokens_completion || 0,
						totalCost: generation?.total_cost || 0,
					}
				} else {
					return {
						type: "usage",
						cacheWriteTokens: 0,
						cacheReadTokens: generation?.native_tokens_cached || 0,
						// openrouter generation endpoint fails often
						inputTokens: generation?.native_tokens_prompt || 0,
						outputTokens: generation?.native_tokens_completion || 0,
						totalCost: generation?.total_cost || 0,
					}
				}
			} catch (error) {
				// ignore if fails
				console.error("Error fetching OpenRouter generation details:", error)
			}
		}
		return undefined
	}
	async *fetchGenerationDetails(genId) {
		// console.log("Fetching generation details for:", genId)
		try {
			const response = await axios.get(`https://openrouter.ai/api/v1/generation?id=${genId}`, {
				headers: {
					Authorization: `Bearer ${this.options.openRouterApiKey}`,
				},
				timeout: 15_000, // this request hangs sometimes
			})
			yield response.data?.data
		} catch (error) {
			// ignore if fails
			console.error("Error fetching OpenRouter generation details:", error)
			throw error
		}
	}
	getModel() {
		let modelId = this.options.openRouterModelId
		const modelInfo = this.options.openRouterModelInfo
		if (modelId && modelInfo) {
			return { id: modelId, info: modelInfo }
		}
		return { id: openRouterDefaultModelId, info: openRouterDefaultModelInfo }
	}
}
__decorate([withRetry()], OpenRouterHandler.prototype, "createMessage", null)
__decorate(
	[withRetry({ maxRetries: 4, baseDelay: 250, maxDelay: 1000, retryAllErrors: true })],
	OpenRouterHandler.prototype,
	"fetchGenerationDetails",
	null,
)
//# sourceMappingURL=openrouter.js.map
