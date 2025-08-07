import { Empty } from "@shared/proto/cline/common"
import { openFile as openFileIntegration } from "@integrations/misc/open-file"
/**
 * Opens a file in the editor
 * @param controller The controller instance
 * @param request The request message containing the file path in the 'value' field
 * @returns Empty response
 */
export async function openFile(_controller, request) {
	if (request.value) {
		openFileIntegration(request.value)
	}
	return Empty.create()
}
//# sourceMappingURL=openFile.js.map
