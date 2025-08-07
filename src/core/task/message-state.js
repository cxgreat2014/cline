import { combineApiRequests } from "@/shared/combineApiRequests"
import { ensureTaskDirectoryExists, saveApiConversationHistory, saveClineMessages } from "../storage/disk"
import { getApiMetrics } from "@/shared/getApiMetrics"
import { combineCommandSequences } from "@/shared/combineCommandSequences"
import { findLastIndex } from "@/shared/array"
import getFolderSize from "get-folder-size"
import { getCwd, getDesktopDir } from "@/utils/path"
export class MessageStateHandler {
	apiConversationHistory = []
	clineMessages = []
	taskIsFavorited
	checkpointTracker
	checkpointTrackerErrorMessage
	updateTaskHistory
	context
	taskId
	uuid
	taskState
	constructor(params) {
		this.context = params.context
		this.taskId = params.taskId
		this.uuid = params.uuid
		this.taskState = params.taskState
		this.taskIsFavorited = params.taskIsFavorited ?? false
		this.updateTaskHistory = params.updateTaskHistory
		this.checkpointTrackerErrorMessage = this.taskState.checkpointTrackerErrorMessage
	}
	setCheckpointTracker(tracker) {
		this.checkpointTracker = tracker
	}
	getApiConversationHistory() {
		return this.apiConversationHistory
	}
	setApiConversationHistory(newHistory) {
		this.apiConversationHistory = newHistory
	}
	getClineMessages() {
		return this.clineMessages
	}
	setClineMessages(newMessages) {
		this.clineMessages = newMessages
	}
	async saveClineMessagesAndUpdateHistory() {
		try {
			await saveClineMessages(this.context, this.taskId, this.clineMessages)
			// combined as they are in ChatView
			const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.clineMessages.slice(1))))
			const taskMessage = this.clineMessages[0] // first message is always the task say
			const lastRelevantMessage =
				this.clineMessages[
					findLastIndex(
						this.clineMessages,
						(message) => !(message.ask === "resume_task" || message.ask === "resume_completed_task"),
					)
				]
			const taskDir = await ensureTaskDirectoryExists(this.context, this.taskId)
			let taskDirSize = 0
			try {
				// getFolderSize.loose silently ignores errors
				// returns # of bytes, size/1000/1000 = MB
				taskDirSize = await getFolderSize.loose(taskDir)
			} catch (error) {
				console.error("Failed to get task directory size:", taskDir, error)
			}
			const cwd = await getCwd(getDesktopDir())
			await this.updateTaskHistory({
				id: this.taskId,
				uuid: this.uuid,
				ts: lastRelevantMessage.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
				size: taskDirSize,
				shadowGitConfigWorkTree: await this.checkpointTracker?.getShadowGitConfigWorkTree(),
				cwdOnTaskInitialization: cwd,
				conversationHistoryDeletedRange: this.taskState.conversationHistoryDeletedRange,
				isFavorited: this.taskIsFavorited,
				checkpointTrackerErrorMessage: this.taskState.checkpointTrackerErrorMessage,
			})
		} catch (error) {
			console.error("Failed to save cline messages:", error)
		}
	}
	async addToApiConversationHistory(message) {
		this.apiConversationHistory.push(message)
		await saveApiConversationHistory(this.context, this.taskId, this.apiConversationHistory)
	}
	async overwriteApiConversationHistory(newHistory) {
		this.apiConversationHistory = newHistory
		await saveApiConversationHistory(this.context, this.taskId, this.apiConversationHistory)
	}
	async addToClineMessages(message) {
		// these values allow us to reconstruct the conversation history at the time this cline message was created
		// it's important that apiConversationHistory is initialized before we add cline messages
		message.conversationHistoryIndex = this.apiConversationHistory.length - 1 // NOTE: this is the index of the last added message which is the user message, and once the clinemessages have been presented we update the apiconversationhistory with the completed assistant message. This means when resetting to a message, we need to +1 this index to get the correct assistant message that this tool use corresponds to
		message.conversationHistoryDeletedRange = this.taskState.conversationHistoryDeletedRange
		this.clineMessages.push(message)
		await this.saveClineMessagesAndUpdateHistory()
	}
	async overwriteClineMessages(newMessages) {
		this.clineMessages = newMessages
		await this.saveClineMessagesAndUpdateHistory()
	}
	async updateClineMessage(index, updates) {
		if (index < 0 || index >= this.clineMessages.length) {
			throw new Error(`Invalid message index: ${index}`)
		}
		// Apply updates to the message
		Object.assign(this.clineMessages[index], updates)
		// Save changes and update history
		await this.saveClineMessagesAndUpdateHistory()
	}
}
//# sourceMappingURL=message-state.js.map
