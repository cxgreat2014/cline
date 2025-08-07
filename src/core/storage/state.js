import { DEFAULT_BROWSER_SETTINGS } from "@shared/BrowserSettings"
import { DEFAULT_AUTO_APPROVAL_SETTINGS } from "@shared/AutoApprovalSettings"
import { DEFAULT_MCP_DISPLAY_MODE } from "@shared/McpDisplayMode"
import { migrateEnableCheckpointsSetting, migrateMcpMarketplaceEnableSetting } from "./state-migrations"
/*
    Storage
    https://dev.to/kompotkot/how-to-use-secretstorage-in-your-vscode-extensions-2hco
    https://www.eliostruyf.com/devhack-code-extension-storage-options/
    */
const isTemporaryProfile = process.env.TEMP_PROFILE === "true"
// In-memory storage for temporary profiles
const inMemoryGlobalState = new Map()
const inMemoryWorkspaceState = new Map()
const inMemorySecrets = new Map()
// global
export async function updateGlobalState(context, key, value) {
	if (isTemporaryProfile) {
		inMemoryGlobalState.set(key, value)
		return
	}
	await context.globalState.update(key, value)
}
export async function getGlobalState(context, key) {
	if (isTemporaryProfile) {
		return inMemoryGlobalState.get(key)
	}
	return await context.globalState.get(key)
}
// Batched operations for performance optimization
export async function updateGlobalStateBatch(context, updates) {
	if (isTemporaryProfile) {
		Object.entries(updates).forEach(([key, value]) => {
			inMemoryGlobalState.set(key, value)
		})
		return
	}
	// Use Promise.all to batch the updates
	await Promise.all(Object.entries(updates).map(([key, value]) => context.globalState.update(key, value)))
}
export async function updateSecretsBatch(context, updates) {
	if (isTemporaryProfile) {
		Object.entries(updates).forEach(([key, value]) => {
			if (value) {
				inMemorySecrets.set(key, value)
			} else {
				inMemorySecrets.delete(key)
			}
		})
		return
	}
	// Use Promise.all to batch the secret updates
	await Promise.all(Object.entries(updates).map(([key, value]) => storeSecret(context, key, value)))
}
// secrets
export async function storeSecret(context, key, value) {
	if (isTemporaryProfile) {
		if (value) {
			inMemorySecrets.set(key, value)
		} else {
			inMemorySecrets.delete(key)
		}
		return
	}
	if (value) {
		await context.secrets.store(key, value)
	} else {
		await context.secrets.delete(key)
	}
}
export async function getSecret(context, key) {
	if (isTemporaryProfile) {
		return inMemorySecrets.get(key)
	}
	return await context.secrets.get(key)
}
// workspace
export async function updateWorkspaceState(context, key, value) {
	if (isTemporaryProfile) {
		inMemoryWorkspaceState.set(key, value)
		return
	}
	await context.workspaceState.update(key, value)
}
export async function getWorkspaceState(context, key) {
	if (isTemporaryProfile) {
		return inMemoryWorkspaceState.get(key)
	}
	return await context.workspaceState.get(key)
}
export async function getAllExtensionState(context) {
	const [
		isNewUser,
		welcomeViewCompleted,
		apiKey,
		openRouterApiKey,
		clineAccountId,
		awsAccessKey,
		awsSecretKey,
		awsSessionToken,
		awsRegion,
		awsUseCrossRegionInference,
		awsBedrockUsePromptCache,
		awsBedrockEndpoint,
		awsProfile,
		awsBedrockApiKey,
		awsUseProfile,
		awsAuthentication,
		vertexProjectId,
		vertexRegion,
		openAiBaseUrl,
		openAiApiKey,
		openAiHeaders,
		ollamaBaseUrl,
		ollamaApiOptionsCtxNum,
		lmStudioBaseUrl,
		anthropicBaseUrl,
		geminiApiKey,
		geminiBaseUrl,
		openAiNativeApiKey,
		deepSeekApiKey,
		requestyApiKey,
		togetherApiKey,
		qwenApiKey,
		doubaoApiKey,
		mistralApiKey,
		azureApiVersion,
		openRouterProviderSorting,
		lastShownAnnouncementId,
		taskHistory,
		autoApprovalSettings,
		browserSettings,
		liteLlmBaseUrl,
		liteLlmUsePromptCache,
		fireworksApiKey,
		fireworksModelMaxCompletionTokens,
		fireworksModelMaxTokens,
		userInfo,
		qwenApiLine,
		moonshotApiLine,
		liteLlmApiKey,
		telemetrySetting,
		asksageApiKey,
		asksageApiUrl,
		xaiApiKey,
		sambanovaApiKey,
		cerebrasApiKey,
		groqApiKey,
		basetenApiKey,
		moonshotApiKey,
		nebiusApiKey,
		huggingFaceApiKey,
		planActSeparateModelsSettingRaw,
		favoritedModelIds,
		globalClineRulesToggles,
		requestTimeoutMs,
		shellIntegrationTimeout,
		enableCheckpointsSettingRaw,
		mcpMarketplaceEnabledRaw,
		mcpDisplayMode,
		mcpResponsesCollapsedRaw,
		globalWorkflowToggles,
		terminalReuseEnabled,
		terminalOutputLineLimit,
		defaultTerminalProfile,
		sapAiCoreClientId,
		sapAiCoreClientSecret,
		sapAiCoreBaseUrl,
		sapAiCoreTokenUrl,
		sapAiResourceGroup,
		claudeCodePath,
		huaweiCloudMaasApiKey,
	] = await Promise.all([
		getGlobalState(context, "isNewUser"),
		getGlobalState(context, "welcomeViewCompleted"),
		getSecret(context, "apiKey"),
		getSecret(context, "openRouterApiKey"),
		getSecret(context, "clineAccountId"),
		getSecret(context, "awsAccessKey"),
		getSecret(context, "awsSecretKey"),
		getSecret(context, "awsSessionToken"),
		getGlobalState(context, "awsRegion"),
		getGlobalState(context, "awsUseCrossRegionInference"),
		getGlobalState(context, "awsBedrockUsePromptCache"),
		getGlobalState(context, "awsBedrockEndpoint"),
		getGlobalState(context, "awsProfile"),
		getSecret(context, "awsBedrockApiKey"),
		getGlobalState(context, "awsUseProfile"),
		getGlobalState(context, "awsAuthentication"),
		getGlobalState(context, "vertexProjectId"),
		getGlobalState(context, "vertexRegion"),
		getGlobalState(context, "openAiBaseUrl"),
		getSecret(context, "openAiApiKey"),
		getGlobalState(context, "openAiHeaders"),
		getGlobalState(context, "ollamaBaseUrl"),
		getGlobalState(context, "ollamaApiOptionsCtxNum"),
		getGlobalState(context, "lmStudioBaseUrl"),
		getGlobalState(context, "anthropicBaseUrl"),
		getSecret(context, "geminiApiKey"),
		getGlobalState(context, "geminiBaseUrl"),
		getSecret(context, "openAiNativeApiKey"),
		getSecret(context, "deepSeekApiKey"),
		getSecret(context, "requestyApiKey"),
		getSecret(context, "togetherApiKey"),
		getSecret(context, "qwenApiKey"),
		getSecret(context, "doubaoApiKey"),
		getSecret(context, "mistralApiKey"),
		getGlobalState(context, "azureApiVersion"),
		getGlobalState(context, "openRouterProviderSorting"),
		getGlobalState(context, "lastShownAnnouncementId"),
		getGlobalState(context, "taskHistory"),
		getGlobalState(context, "autoApprovalSettings"),
		getGlobalState(context, "browserSettings"),
		getGlobalState(context, "liteLlmBaseUrl"),
		getGlobalState(context, "liteLlmUsePromptCache"),
		getSecret(context, "fireworksApiKey"),
		getGlobalState(context, "fireworksModelMaxCompletionTokens"),
		getGlobalState(context, "fireworksModelMaxTokens"),
		getGlobalState(context, "userInfo"),
		getGlobalState(context, "qwenApiLine"),
		getGlobalState(context, "moonshotApiLine"),
		getSecret(context, "liteLlmApiKey"),
		getGlobalState(context, "telemetrySetting"),
		getSecret(context, "asksageApiKey"),
		getGlobalState(context, "asksageApiUrl"),
		getSecret(context, "xaiApiKey"),
		getSecret(context, "sambanovaApiKey"),
		getSecret(context, "cerebrasApiKey"),
		getSecret(context, "groqApiKey"),
		getSecret(context, "basetenApiKey"),
		getSecret(context, "moonshotApiKey"),
		getSecret(context, "nebiusApiKey"),
		getSecret(context, "huggingFaceApiKey"),
		getGlobalState(context, "planActSeparateModelsSetting"),
		getGlobalState(context, "favoritedModelIds"),
		getGlobalState(context, "globalClineRulesToggles"),
		getGlobalState(context, "requestTimeoutMs"),
		getGlobalState(context, "shellIntegrationTimeout"),
		getGlobalState(context, "enableCheckpointsSetting"),
		getGlobalState(context, "mcpMarketplaceEnabled"),
		getGlobalState(context, "mcpDisplayMode"),
		getGlobalState(context, "mcpResponsesCollapsed"),
		getGlobalState(context, "globalWorkflowToggles"),
		getGlobalState(context, "terminalReuseEnabled"),
		getGlobalState(context, "terminalOutputLineLimit"),
		getGlobalState(context, "defaultTerminalProfile"),
		getSecret(context, "sapAiCoreClientId"),
		getSecret(context, "sapAiCoreClientSecret"),
		getGlobalState(context, "sapAiCoreBaseUrl"),
		getGlobalState(context, "sapAiCoreTokenUrl"),
		getGlobalState(context, "sapAiResourceGroup"),
		getGlobalState(context, "claudeCodePath"),
		getSecret(context, "huaweiCloudMaasApiKey"),
	])
	const [localClineRulesToggles, localWindsurfRulesToggles, localCursorRulesToggles, localWorkflowToggles] = await Promise.all([
		getWorkspaceState(context, "localClineRulesToggles"),
		getWorkspaceState(context, "localWindsurfRulesToggles"),
		getWorkspaceState(context, "localCursorRulesToggles"),
		getWorkspaceState(context, "workflowToggles"),
	])
	const [
		preferredLanguage,
		openaiReasoningEffort,
		mode,
		strictPlanModeEnabled,
		// Plan mode configurations
		planModeApiProvider,
		planModeApiModelId,
		planModeThinkingBudgetTokens,
		planModeReasoningEffort,
		planModeVsCodeLmModelSelector,
		planModeAwsBedrockCustomSelected,
		planModeAwsBedrockCustomModelBaseId,
		planModeOpenRouterModelId,
		planModeOpenRouterModelInfo,
		planModeOpenAiModelId,
		planModeOpenAiModelInfo,
		planModeOllamaModelId,
		planModeLmStudioModelId,
		planModeLiteLlmModelId,
		planModeLiteLlmModelInfo,
		planModeRequestyModelId,
		planModeRequestyModelInfo,
		planModeTogetherModelId,
		planModeFireworksModelId,
		planModeSapAiCoreModelId,
		planModeGroqModelId,
		planModeGroqModelInfo,
		planModeBasetenModelId,
		planModeBasetenModelInfo,
		planModeHuggingFaceModelId,
		planModeHuggingFaceModelInfo,
		planModeHuaweiCloudMaasModelId,
		planModeHuaweiCloudMaasModelInfo,
		// Act mode configurations
		actModeApiProvider,
		actModeApiModelId,
		actModeThinkingBudgetTokens,
		actModeReasoningEffort,
		actModeVsCodeLmModelSelector,
		actModeAwsBedrockCustomSelected,
		actModeAwsBedrockCustomModelBaseId,
		actModeOpenRouterModelId,
		actModeOpenRouterModelInfo,
		actModeOpenAiModelId,
		actModeOpenAiModelInfo,
		actModeOllamaModelId,
		actModeLmStudioModelId,
		actModeLiteLlmModelId,
		actModeLiteLlmModelInfo,
		actModeRequestyModelId,
		actModeRequestyModelInfo,
		actModeTogetherModelId,
		actModeFireworksModelId,
		actModeSapAiCoreModelId,
		actModeGroqModelId,
		actModeGroqModelInfo,
		actModeBasetenModelId,
		actModeBasetenModelInfo,
		actModeHuggingFaceModelId,
		actModeHuggingFaceModelInfo,
		actModeHuaweiCloudMaasModelId,
		actModeHuaweiCloudMaasModelInfo,
	] = await Promise.all([
		getGlobalState(context, "preferredLanguage"),
		getGlobalState(context, "openaiReasoningEffort"),
		getGlobalState(context, "mode"),
		getGlobalState(context, "strictPlanModeEnabled"),
		// Plan mode configurations
		getGlobalState(context, "planModeApiProvider"),
		getGlobalState(context, "planModeApiModelId"),
		getGlobalState(context, "planModeThinkingBudgetTokens"),
		getGlobalState(context, "planModeReasoningEffort"),
		getGlobalState(context, "planModeVsCodeLmModelSelector"),
		getGlobalState(context, "planModeAwsBedrockCustomSelected"),
		getGlobalState(context, "planModeAwsBedrockCustomModelBaseId"),
		getGlobalState(context, "planModeOpenRouterModelId"),
		getGlobalState(context, "planModeOpenRouterModelInfo"),
		getGlobalState(context, "planModeOpenAiModelId"),
		getGlobalState(context, "planModeOpenAiModelInfo"),
		getGlobalState(context, "planModeOllamaModelId"),
		getGlobalState(context, "planModeLmStudioModelId"),
		getGlobalState(context, "planModeLiteLlmModelId"),
		getGlobalState(context, "planModeLiteLlmModelInfo"),
		getGlobalState(context, "planModeRequestyModelId"),
		getGlobalState(context, "planModeRequestyModelInfo"),
		getGlobalState(context, "planModeTogetherModelId"),
		getGlobalState(context, "planModeFireworksModelId"),
		getGlobalState(context, "planModeSapAiCoreModelId"),
		getGlobalState(context, "planModeGroqModelId"),
		getGlobalState(context, "planModeGroqModelInfo"),
		getGlobalState(context, "planModeBasetenModelId"),
		getGlobalState(context, "planModeBasetenModelInfo"),
		getGlobalState(context, "planModeHuggingFaceModelId"),
		getGlobalState(context, "planModeHuggingFaceModelInfo"),
		getGlobalState(context, "planModeHuaweiCloudMaasModelId"),
		getGlobalState(context, "planModeHuaweiCloudMaasModelInfo"),
		// Act mode configurations
		getGlobalState(context, "actModeApiProvider"),
		getGlobalState(context, "actModeApiModelId"),
		getGlobalState(context, "actModeThinkingBudgetTokens"),
		getGlobalState(context, "actModeReasoningEffort"),
		getGlobalState(context, "actModeVsCodeLmModelSelector"),
		getGlobalState(context, "actModeAwsBedrockCustomSelected"),
		getGlobalState(context, "actModeAwsBedrockCustomModelBaseId"),
		getGlobalState(context, "actModeOpenRouterModelId"),
		getGlobalState(context, "actModeOpenRouterModelInfo"),
		getGlobalState(context, "actModeOpenAiModelId"),
		getGlobalState(context, "actModeOpenAiModelInfo"),
		getGlobalState(context, "actModeOllamaModelId"),
		getGlobalState(context, "actModeLmStudioModelId"),
		getGlobalState(context, "actModeLiteLlmModelId"),
		getGlobalState(context, "actModeLiteLlmModelInfo"),
		getGlobalState(context, "actModeRequestyModelId"),
		getGlobalState(context, "actModeRequestyModelInfo"),
		getGlobalState(context, "actModeTogetherModelId"),
		getGlobalState(context, "actModeFireworksModelId"),
		getGlobalState(context, "actModeSapAiCoreModelId"),
		getGlobalState(context, "actModeGroqModelId"),
		getGlobalState(context, "actModeGroqModelInfo"),
		getGlobalState(context, "actModeBasetenModelId"),
		getGlobalState(context, "actModeBasetenModelInfo"),
		getGlobalState(context, "actModeHuggingFaceModelId"),
		getGlobalState(context, "actModeHuggingFaceModelInfo"),
		getGlobalState(context, "actModeHuaweiCloudMaasModelId"),
		getGlobalState(context, "actModeHuaweiCloudMaasModelInfo"),
	])
	let apiProvider
	if (planModeApiProvider) {
		apiProvider = planModeApiProvider
	} else {
		// Either new user or legacy user that doesn't have the apiProvider stored in state
		// (If they're using OpenRouter or Bedrock, then apiProvider state will exist)
		if (apiKey) {
			apiProvider = "anthropic"
		} else {
			// New users should default to openrouter, since they've opted to use an API key instead of signing in
			apiProvider = "openrouter"
		}
	}
	const mcpMarketplaceEnabled = await migrateMcpMarketplaceEnableSetting(mcpMarketplaceEnabledRaw)
	const enableCheckpointsSetting = await migrateEnableCheckpointsSetting(enableCheckpointsSettingRaw)
	const mcpResponsesCollapsed = mcpResponsesCollapsedRaw ?? false
	// Plan/Act separate models setting is a boolean indicating whether the user wants to use different models for plan and act. Existing users expect this to be enabled, while we want new users to opt in to this being disabled by default.
	// On win11 state sometimes initializes as empty string instead of undefined
	let planActSeparateModelsSetting = undefined
	if (planActSeparateModelsSettingRaw === true || planActSeparateModelsSettingRaw === false) {
		planActSeparateModelsSetting = planActSeparateModelsSettingRaw
	} else {
		// default to true for existing users
		if (planModeApiProvider) {
			planActSeparateModelsSetting = true
		} else {
			// default to false for new users
			planActSeparateModelsSetting = false
		}
		// this is a special case where it's a new state, but we want it to default to different values for existing and new users.
		// persist so next time state is retrieved it's set to the correct value.
		await updateGlobalState(context, "planActSeparateModelsSetting", planActSeparateModelsSetting)
	}
	return {
		apiConfiguration: {
			apiKey,
			openRouterApiKey,
			clineAccountId,
			claudeCodePath,
			awsAccessKey,
			awsSecretKey,
			awsSessionToken,
			awsRegion,
			awsUseCrossRegionInference,
			awsBedrockUsePromptCache,
			awsBedrockEndpoint,
			awsProfile,
			awsBedrockApiKey,
			awsUseProfile,
			awsAuthentication,
			vertexProjectId,
			vertexRegion,
			openAiBaseUrl,
			openAiApiKey,
			openAiHeaders: openAiHeaders || {},
			ollamaBaseUrl,
			ollamaApiOptionsCtxNum,
			lmStudioBaseUrl,
			anthropicBaseUrl,
			geminiApiKey,
			geminiBaseUrl,
			openAiNativeApiKey,
			deepSeekApiKey,
			requestyApiKey,
			togetherApiKey,
			qwenApiKey,
			qwenApiLine,
			moonshotApiLine,
			doubaoApiKey,
			mistralApiKey,
			azureApiVersion,
			openRouterProviderSorting,
			liteLlmBaseUrl,
			liteLlmApiKey,
			liteLlmUsePromptCache,
			fireworksApiKey,
			fireworksModelMaxCompletionTokens,
			fireworksModelMaxTokens,
			asksageApiKey,
			asksageApiUrl,
			xaiApiKey,
			sambanovaApiKey,
			cerebrasApiKey,
			groqApiKey,
			basetenApiKey,
			moonshotApiKey,
			nebiusApiKey,
			favoritedModelIds,
			requestTimeoutMs,
			sapAiCoreClientId,
			sapAiCoreClientSecret,
			sapAiCoreBaseUrl,
			sapAiCoreTokenUrl,
			sapAiResourceGroup,
			huggingFaceApiKey,
			huaweiCloudMaasApiKey,
			// Plan mode configurations
			planModeApiProvider: planModeApiProvider || apiProvider,
			planModeApiModelId,
			planModeThinkingBudgetTokens,
			planModeReasoningEffort,
			planModeVsCodeLmModelSelector,
			planModeAwsBedrockCustomSelected,
			planModeAwsBedrockCustomModelBaseId,
			planModeOpenRouterModelId,
			planModeOpenRouterModelInfo,
			planModeOpenAiModelId,
			planModeOpenAiModelInfo,
			planModeOllamaModelId,
			planModeLmStudioModelId,
			planModeLiteLlmModelId,
			planModeLiteLlmModelInfo,
			planModeRequestyModelId,
			planModeRequestyModelInfo,
			planModeTogetherModelId,
			planModeFireworksModelId,
			planModeSapAiCoreModelId,
			planModeGroqModelId,
			planModeGroqModelInfo,
			planModeBasetenModelId,
			planModeBasetenModelInfo,
			planModeHuggingFaceModelId,
			planModeHuggingFaceModelInfo,
			planModeHuaweiCloudMaasModelId,
			planModeHuaweiCloudMaasModelInfo,
			// Act mode configurations
			actModeApiProvider: actModeApiProvider || apiProvider,
			actModeApiModelId,
			actModeThinkingBudgetTokens,
			actModeReasoningEffort,
			actModeVsCodeLmModelSelector,
			actModeAwsBedrockCustomSelected,
			actModeAwsBedrockCustomModelBaseId,
			actModeOpenRouterModelId,
			actModeOpenRouterModelInfo,
			actModeOpenAiModelId,
			actModeOpenAiModelInfo,
			actModeOllamaModelId,
			actModeLmStudioModelId,
			actModeLiteLlmModelId,
			actModeLiteLlmModelInfo,
			actModeRequestyModelId,
			actModeRequestyModelInfo,
			actModeTogetherModelId,
			actModeFireworksModelId,
			actModeSapAiCoreModelId,
			actModeGroqModelId,
			actModeGroqModelInfo,
			actModeBasetenModelId,
			actModeBasetenModelInfo,
			actModeHuggingFaceModelId,
			actModeHuggingFaceModelInfo,
			actModeHuaweiCloudMaasModelId,
			actModeHuaweiCloudMaasModelInfo,
		},
		isNewUser: isNewUser ?? true,
		welcomeViewCompleted,
		lastShownAnnouncementId,
		taskHistory,
		autoApprovalSettings: autoApprovalSettings || DEFAULT_AUTO_APPROVAL_SETTINGS, // default value can be 0 or empty string
		globalClineRulesToggles: globalClineRulesToggles || {},
		browserSettings: { ...DEFAULT_BROWSER_SETTINGS, ...browserSettings }, // this will ensure that older versions of browserSettings (e.g. before remoteBrowserEnabled was added) are merged with the default values (false for remoteBrowserEnabled)
		preferredLanguage: preferredLanguage || "English",
		openaiReasoningEffort: openaiReasoningEffort || "medium",
		mode: mode || "act",
		strictPlanModeEnabled: strictPlanModeEnabled ?? false,
		userInfo,
		mcpMarketplaceEnabled: mcpMarketplaceEnabled,
		mcpDisplayMode: mcpDisplayMode ?? DEFAULT_MCP_DISPLAY_MODE,
		mcpResponsesCollapsed: mcpResponsesCollapsed,
		telemetrySetting: telemetrySetting || "unset",
		planActSeparateModelsSetting,
		enableCheckpointsSetting: enableCheckpointsSetting,
		shellIntegrationTimeout: shellIntegrationTimeout || 4000,
		terminalReuseEnabled: terminalReuseEnabled ?? true,
		terminalOutputLineLimit: terminalOutputLineLimit ?? 500,
		defaultTerminalProfile: defaultTerminalProfile ?? "default",
		globalWorkflowToggles: globalWorkflowToggles || {},
		localClineRulesToggles: localClineRulesToggles || {},
		localWindsurfRulesToggles: localWindsurfRulesToggles || {},
		localCursorRulesToggles: localCursorRulesToggles || {},
		localWorkflowToggles: localWorkflowToggles || {},
	}
}
export async function resetWorkspaceState(controller) {
	const context = controller.context
	await Promise.all(context.workspaceState.keys().map((key) => controller.context.workspaceState.update(key, undefined)))
	await controller.cacheService.reInitialize()
}
export async function resetGlobalState(controller) {
	// TODO: Reset all workspace states?
	const context = controller.context
	await Promise.all(context.globalState.keys().map((key) => context.globalState.update(key, undefined)))
	const secretKeys = [
		"apiKey",
		"openRouterApiKey",
		"awsAccessKey",
		"awsSecretKey",
		"awsSessionToken",
		"awsBedrockApiKey",
		"openAiApiKey",
		"geminiApiKey",
		"openAiNativeApiKey",
		"deepSeekApiKey",
		"requestyApiKey",
		"togetherApiKey",
		"qwenApiKey",
		"doubaoApiKey",
		"mistralApiKey",
		"clineAccountId",
		"liteLlmApiKey",
		"fireworksApiKey",
		"asksageApiKey",
		"xaiApiKey",
		"sambanovaApiKey",
		"cerebrasApiKey",
		"groqApiKey",
		"basetenApiKey",
		"moonshotApiKey",
		"nebiusApiKey",
		"huggingFaceApiKey",
		"huaweiCloudMaasApiKey",
	]
	await Promise.all(secretKeys.map((key) => storeSecret(context, key, undefined)))
	await controller.cacheService.reInitialize()
}
//# sourceMappingURL=state.js.map
