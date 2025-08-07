import * as vscode from "vscode"
import { Empty } from "@shared/proto/cline/common"
import { telemetryService } from "@services/posthog/PostHogClientProvider"
/**
 * Opens the Cline walkthrough in VSCode
 * @param controller The controller instance
 * @param request Empty request
 * @returns Empty response
 */
export async function openWalkthrough(controller, request) {
	try {
		await vscode.commands.executeCommand("workbench.action.openWalkthrough", "saoudrizwan.claude-dev#ClineWalkthrough")
		telemetryService.captureButtonClick("webview_openWalkthrough")
		return Empty.create({})
	} catch (error) {
		console.error(`Failed to open walkthrough: ${error}`)
		throw error
	}
}
//# sourceMappingURL=openWalkthrough.js.map
