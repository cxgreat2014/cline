import { updateGlobalState } from "../../storage/state"
export async function updateTerminalConnectionTimeout(controller, request) {
	const timeoutMs = request.timeoutMs
	// Update the terminal connection timeout setting in the state
	await updateGlobalState(controller.context, "shellIntegrationTimeout", timeoutMs)
	// Broadcast state update to all webviews
	await controller.postStateToWebview()
	return { timeoutMs }
}
//# sourceMappingURL=updateTerminalConnectionTimeout.js.map
