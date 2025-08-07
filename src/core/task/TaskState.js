export class TaskState {
	// Streaming flags
	isStreaming = false
	isWaitingForFirstChunk = false
	didCompleteReadingStream = false
	// Content processing
	currentStreamingContentIndex = 0
	assistantMessageContent = []
	userMessageContent = []
	userMessageContentReady = false
	// Presentation locks
	presentAssistantMessageLocked = false
	presentAssistantMessageHasPendingUpdates = false
	// Claude 4 experimental JSON streaming
	streamingJsonReplacer
	lastProcessedJsonLength = 0
	// Ask/Response handling
	askResponse
	askResponseText
	askResponseImages
	askResponseFiles
	lastMessageTs
	// Plan mode specific state
	isAwaitingPlanResponse = false
	didRespondToPlanAskBySwitchingMode = false
	// Context and history
	conversationHistoryDeletedRange
	// Tool execution flags
	didRejectTool = false
	didAlreadyUseTool = false
	didEditFile = false
	// Consecutive request tracking
	consecutiveAutoApprovedRequestsCount = 0
	// Error tracking
	consecutiveMistakeCount = 0
	didAutomaticallyRetryFailedApiRequest = false
	checkpointTrackerErrorMessage
	// Task Initialization
	isInitialized = false
	// Task Abort / Cancellation
	abort = false
	didFinishAbortingStream = false
	abandoned = false
}
//# sourceMappingURL=TaskState.js.map
