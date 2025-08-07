import * as vscode from "vscode"
import {
	GetDiagnosticsResponse,
	FileDiagnostics,
	Diagnostic,
	DiagnosticRange,
	DiagnosticPosition,
	DiagnosticSeverity,
} from "@/shared/proto/host/workspace"
export async function getDiagnostics(request) {
	// Get all diagnostics from VS Code
	const vscodeAllDiagnostics = vscode.languages.getDiagnostics()
	const fileDiagnostics = []
	for (const [uri, diagnostics] of vscodeAllDiagnostics) {
		if (diagnostics.length > 0) {
			const convertedDiagnostics = diagnostics.map((vsDiagnostic) => {
				// Convert VS Code severity to proto severity
				let severity
				switch (vsDiagnostic.severity) {
					case vscode.DiagnosticSeverity.Error:
						severity = DiagnosticSeverity.DIAGNOSTIC_ERROR
						break
					case vscode.DiagnosticSeverity.Warning:
						severity = DiagnosticSeverity.DIAGNOSTIC_WARNING
						break
					case vscode.DiagnosticSeverity.Information:
						severity = DiagnosticSeverity.DIAGNOSTIC_INFORMATION
						break
					case vscode.DiagnosticSeverity.Hint:
						severity = DiagnosticSeverity.DIAGNOSTIC_HINT
						break
					default:
						severity = DiagnosticSeverity.DIAGNOSTIC_ERROR
				}
				return Diagnostic.create({
					message: vsDiagnostic.message,
					range: DiagnosticRange.create({
						start: DiagnosticPosition.create({
							line: vsDiagnostic.range.start.line,
							character: vsDiagnostic.range.start.character,
						}),
						end: DiagnosticPosition.create({
							line: vsDiagnostic.range.end.line,
							character: vsDiagnostic.range.end.character,
						}),
					}),
					severity: severity,
					source: vsDiagnostic.source || undefined,
				})
			})
			fileDiagnostics.push(
				FileDiagnostics.create({
					filePath: uri.fsPath,
					diagnostics: convertedDiagnostics,
				}),
			)
		}
	}
	return GetDiagnosticsResponse.create({
		fileDiagnostics: fileDiagnostics,
	})
}
//# sourceMappingURL=getDiagnostics.js.map
