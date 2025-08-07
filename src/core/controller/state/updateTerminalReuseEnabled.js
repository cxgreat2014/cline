import * as proto from "@/shared/proto"
import { updateGlobalState } from "../../storage/state"
export async function updateTerminalReuseEnabled(controller, request) {
	const enabled = request.value
	// Update the terminal reuse setting in the state
	await updateGlobalState(controller.context, "terminalReuseEnabled", enabled)
	// Broadcast state update to all webviews
	await controller.postStateToWebview()
	return proto.cline.Empty.create({})
}
//# sourceMappingURL=updateTerminalReuseEnabled.js.map
