import { Empty } from "@shared/proto/cline/common"
import { updateGlobalState } from "../../storage/state"
/**
 * Sets the welcomeViewCompleted flag to the specified boolean value
 * @param controller The controller instance
 * @param request The boolean request containing the value to set
 * @returns Empty response
 */
export async function setWelcomeViewCompleted(controller, request) {
	try {
		// Update the global state to set welcomeViewCompleted to the requested value
		await updateGlobalState(controller.context, "welcomeViewCompleted", request.value)
		await controller.postStateToWebview()
		console.log(`Welcome view completed set to: ${request.value}`)
		return Empty.create({})
	} catch (error) {
		console.error("Failed to set welcome view completed:", error)
		throw error
	}
}
//# sourceMappingURL=setWelcomeViewCompleted.js.map
