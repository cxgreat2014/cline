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
import { ClineAccountService } from "@/services/account/ClineAccountService"
import { openRouterDefaultModelId, openRouterDefaultModelInfo } from "@shared/api"
import { createOpenRouterStream } from "../transform/openrouter-stream"
import axios from "axios"
import { withRetry } from "../retry"
import { AuthService } from "@/services/auth/AuthService"
import OpenAI from "openai"
import { version as extensionVersion } from "../../../package.json"
import { shouldSkipReasoningForModel } from "@utils/model-utils"
import { CLINE_ACCOUNT_AUTH_ERROR_MESSAGE } from "@/shared/ClineAccount"
import { clineEnvConfig } from "@/config"
export class ClineHandler {
	options
	clineAccountService = ClineAccountService.getInstance()
	_authService
	client
	_baseUrl = clineEnvConfig.apiBaseUrl
	lastGenerationId
	counter = 0
	constructor(options) {
		this.options = options
		this._authService = AuthService.getInstance()
	}
	async ensureClient() {
		const clineAccountAuthToken = await this._authService.getAuthToken()
		if (!clineAccountAuthToken) {
			throw new Error(CLINE_ACCOUNT_AUTH_ERROR_MESSAGE)
		}
		if (!this.client) {
			try {
				this.client = new OpenAI({
					baseURL: `${this._baseUrl}/api/v1`,
					apiKey: clineAccountAuthToken,
					defaultHeaders: {
						"HTTP-Referer": "https://cline.bot",
						"X-Title": "Cline",
						"X-Task-ID": this.options.taskId || "",
						"X-Cline-Version": extensionVersion,
					},
				})
			} catch (error) {
				throw new Error(`Error creating Cline client: ${error.message}`)
			}
		}
		// Ensure the client is always using the latest auth token
		this.client.apiKey = clineAccountAuthToken
		return this.client
	}
	async *createMessage(systemPrompt, messages) {
		try {
			const client = await this.ensureClient()
			this.lastGenerationId = undefined
			let didOutputUsage = false
			const stream = await createOpenRouterStream(
				client,
				systemPrompt,
				messages,
				this.getModel(),
				this.options.reasoningEffort,
				this.options.thinkingBudgetTokens,
				this.options.openRouterProviderSorting,
			)
			for await (const chunk of stream) {
				// openrouter returns an error object instead of the openai sdk throwing an error
				if ("error" in chunk) {
					const error = chunk.error
					console.error(`Cline API Error: ${error?.code} - ${error?.message}`)
					// Include metadata in the error message if available
					const metadataStr = error.metadata ? `\nMetadata: ${JSON.stringify(error.metadata, null, 2)}` : ""
					throw new Error(`Cline API Error ${error.code}: ${error.message}${metadataStr}`)
				}
				if (!this.lastGenerationId && chunk.id) {
					this.lastGenerationId = chunk.id
				}
				// Check for mid-stream error via finish_reason
				const choice = chunk.choices?.[0]
				// OpenRouter may return finish_reason = "error" with error details
				if (choice?.finish_reason === "error") {
					const choiceWithError = choice
					if (choiceWithError.error) {
						const error = choiceWithError.error
						console.error(`Cline Mid-Stream Error: ${error.code || error.type || "Unknown"} - ${error.message}`)
						throw new Error(`Cline Mid-Stream Error: ${error.code || error.type || "Unknown"} - ${error.message}`)
					} else {
						throw new Error(
							"Cline Mid-Stream Error: Stream terminated with error status but no error details provided",
						)
					}
				}
				const delta = choice?.delta
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
					// @ts-ignore-next-line
					let totalCost = (chunk.usage.cost || 0) + (chunk.usage.cost_details?.upstream_inference_cost || 0)
					const modelId = this.getModel().id
					// const provider = modelId.split("/")[0]
					// // If provider is x-ai, set totalCost to 0 (we're doing a promo)
					// if (provider === "x-ai") {
					// 	totalCost = 0
					// }
					if (modelId.includes("gemini")) {
						yield {
							type: "usage",
							cacheWriteTokens: 0,
							cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens || 0,
							inputTokens:
								(chunk.usage.prompt_tokens || 0) - (chunk.usage.prompt_tokens_details?.cached_tokens || 0),
							outputTokens: chunk.usage.completion_tokens || 0,
							// @ts-ignore-next-line
							totalCost,
						}
					} else {
						yield {
							type: "usage",
							cacheWriteTokens: 0,
							cacheReadTokens: chunk.usage.prompt_tokens_details?.cached_tokens || 0,
							inputTokens: chunk.usage.prompt_tokens || 0,
							outputTokens: chunk.usage.completion_tokens || 0,
							// @ts-ignore-next-line
							totalCost,
						}
					}
					didOutputUsage = true
				}
			}
			// Fallback to generation endpoint if usage chunk not returned
			if (!didOutputUsage) {
				console.warn("Cline API did not return usage chunk, fetching from generation endpoint")
				const apiStreamUsage = await this.getApiStreamUsage()
				if (apiStreamUsage) {
					yield apiStreamUsage
				}
			}
		} catch (error) {
			console.error("Cline API Error:", error)
			throw error
		}
	}
	async getApiStreamUsage() {
		if (this.lastGenerationId) {
			try {
				// TODO: replace this with firebase auth
				// TODO: use global API Host
				const response = await axios.get(`${this.clineAccountService.baseUrl}/generation?id=${this.lastGenerationId}`, {
					headers: {
						Authorization: `Bearer ${this.options.clineAccountId}`,
					},
					timeout: 15_000, // this request hangs sometimes
				})
				const generation = response.data
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
				console.error("Error fetching cline generation details:", error)
			}
		}
		return undefined
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
__decorate([withRetry()], ClineHandler.prototype, "createMessage", null)
//# sourceMappingURL=cline.js.map
