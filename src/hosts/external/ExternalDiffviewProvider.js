import { HostProvider } from "@/hosts/host-provider"
import { DiffViewProvider } from "@/integrations/editor/DiffViewProvider"
import { DiagnosticSeverity } from "@/shared/proto/host/workspace"
import { status } from "@grpc/grpc-js"
export class ExternalDiffViewProvider extends DiffViewProvider {
	activeDiffEditorId
	async openDiffEditor() {
		if (!this.absolutePath) {
			return
		}
		const response = await HostProvider.diff.openDiff({
			path: this.absolutePath,
			content: this.originalContent ?? "",
		})
		this.activeDiffEditorId = response.diffId
	}
	async replaceText(content, rangeToReplace, _currentLine) {
		if (!this.activeDiffEditorId) {
			return
		}
		await HostProvider.diff.replaceText({
			diffId: this.activeDiffEditorId,
			content: content,
			startLine: rangeToReplace.startLine,
			endLine: rangeToReplace.endLine,
		})
	}
	async truncateDocument(lineNumber) {
		if (!this.activeDiffEditorId) {
			return
		}
		await HostProvider.diff.truncateDocument({
			diffId: this.activeDiffEditorId,
			endLine: lineNumber,
		})
	}
	async saveDocument() {
		if (!this.activeDiffEditorId) {
			return false
		}
		try {
			await HostProvider.diff.saveDocument({ diffId: this.activeDiffEditorId })
			return true
		} catch (err) {
			if (err.code === status.NOT_FOUND) {
				// This can happen when the task is reloaded or the diff editor is closed. So, don't
				// consider it a real error.
				console.log("Diff not found:", this.activeDiffEditorId)
				return false
			} else {
				throw err
			}
		}
	}
	async scrollEditorToLine(line) {
		if (!this.activeDiffEditorId) {
			return
		}
		await HostProvider.diff.scrollDiff({ diffId: this.activeDiffEditorId, line: line })
	}
	async scrollAnimation(_startLine, _endLine) {}
	async getDocumentText() {
		if (!this.activeDiffEditorId) {
			return undefined
		}
		return (await HostProvider.diff.getDocumentText({ diffId: this.activeDiffEditorId })).content
	}
	async getNewDiagnosticProblems() {
		// Get diagnostics using the HostBridge workspace service
		const response = await HostProvider.workspace.getDiagnostics({})
		if (response.fileDiagnostics.length === 0) {
			return ""
		}
		let result = ""
		for (const fileDiagnostics of response.fileDiagnostics) {
			const errors = fileDiagnostics.diagnostics.filter((d) => d.severity === DiagnosticSeverity.DIAGNOSTIC_ERROR)
			if (errors.length > 0) {
				result += `\n\n${fileDiagnostics.filePath}`
				for (const diagnostic of errors) {
					const line = (diagnostic.range?.start?.line || 0) + 1 // Proto lines are 0-indexed
					const source = diagnostic.source ? `${diagnostic.source} ` : ""
					result += `\n- [${source}Error] Line ${line}: ${diagnostic.message}`
				}
			}
		}
		return result.trim()
	}
	async closeDiffView() {
		if (!this.activeDiffEditorId) {
			return
		}
		await HostProvider.diff.closeDiff({ diffId: this.activeDiffEditorId })
		this.activeDiffEditorId = undefined
	}
	async resetDiffView() {
		this.activeDiffEditorId = undefined
	}
}
//# sourceMappingURL=ExternalDiffviewProvider.js.map
