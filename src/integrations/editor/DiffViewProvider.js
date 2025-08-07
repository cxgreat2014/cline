import * as path from "path"
import * as fs from "fs/promises"
import { createDirectoriesForFile } from "@utils/fs"
import { getCwd } from "@utils/path"
import { formatResponse } from "@core/prompts/responses"
import * as diff from "diff"
import { detectEncoding } from "../misc/extract-text"
import * as iconv from "iconv-lite"
import { HostProvider } from "@/hosts/host-provider"
export class DiffViewProvider {
	editType
	isEditing = false
	originalContent
	createdDirs = []
	documentWasOpen = false
	relPath
	absolutePath
	fileEncoding = "utf8"
	streamedLines = []
	newContent
	constructor() {}
	async open(relPath) {
		this.isEditing = true
		this.relPath = relPath
		this.absolutePath = path.resolve(await getCwd(), relPath)
		const fileExists = this.editType === "modify"
		// if the file is already open, ensure it's not dirty before getting its contents
		if (fileExists) {
			await HostProvider.workspace.saveOpenDocumentIfDirty({
				filePath: this.absolutePath,
			})
			const fileBuffer = await fs.readFile(this.absolutePath)
			this.fileEncoding = await detectEncoding(fileBuffer)
			this.originalContent = iconv.decode(fileBuffer, this.fileEncoding)
		} else {
			this.originalContent = ""
			this.fileEncoding = "utf8"
		}
		// for new files, create any necessary directories and keep track of new directories to delete if the user denies the operation
		this.createdDirs = await createDirectoriesForFile(this.absolutePath)
		// make sure the file exists before we open it
		if (!fileExists) {
			await fs.writeFile(this.absolutePath, "")
		}
		await this.openDiffEditor()
		await this.scrollEditorToLine(0)
		this.streamedLines = []
	}
	async update(accumulatedContent, isFinal, changeLocation) {
		if (!this.isEditing) {
			throw new Error("Not editing any file")
		}
		// --- Fix to prevent duplicate BOM ---
		// Strip potential BOM from incoming content. VS Code's `applyEdit` might implicitly handle the BOM
		// when replacing from the start (0,0), and we want to avoid duplication.
		// Final BOM is handled in `saveChanges`.
		if (accumulatedContent.startsWith("\ufeff")) {
			accumulatedContent = accumulatedContent.slice(1) // Remove the BOM character
		}
		this.newContent = accumulatedContent
		const accumulatedLines = accumulatedContent.split("\n")
		if (!isFinal) {
			accumulatedLines.pop() // remove the last partial line only if it's not the final update
		}
		const diffLines = accumulatedLines.slice(this.streamedLines.length)
		// Instead of animating each line, we'll update in larger chunks
		const currentLine = this.streamedLines.length + diffLines.length - 1
		if (currentLine >= 0) {
			// Only proceed if we have new lines
			// Replace all content up to the current line with accumulated lines
			// This is necessary (as compared to inserting one line at a time) to handle cases where html tags on previous lines are auto closed for example
			const contentToReplace = accumulatedLines.slice(0, currentLine + 1).join("\n") + "\n"
			const rangeToReplace = { startLine: 0, endLine: currentLine + 1 }
			await this.replaceText(contentToReplace, rangeToReplace, currentLine)
			// Scroll to the actual change location if provided.
			if (changeLocation) {
				// We have the actual location of the change, scroll to it
				const targetLine = changeLocation.startLine
				await this.scrollEditorToLine(targetLine)
			} else {
				// Fallback to the old logic for non-replacement updates
				if (diffLines.length <= 5) {
					// For small changes, just jump directly to the line
					await this.scrollEditorToLine(currentLine)
				} else {
					// For larger changes, create a quick scrolling animation
					const startLine = this.streamedLines.length
					const endLine = currentLine
					await this.scrollAnimation(startLine, endLine)
					// Ensure we end at the final line
					await this.scrollEditorToLine(currentLine)
				}
			}
		}
		// Update the streamedLines with the new accumulated content
		this.streamedLines = accumulatedLines
		if (isFinal) {
			// Handle any remaining lines if the new content is shorter than the original
			await this.truncateDocument(this.streamedLines.length)
			// Add empty last line if original content had one
			const hasEmptyLastLine = this.originalContent?.endsWith("\n")
			if (hasEmptyLastLine) {
				const accumulatedLines = accumulatedContent.split("\n")
				if (accumulatedLines[accumulatedLines.length - 1] !== "") {
					accumulatedContent += "\n"
				}
			}
		}
	}
	async saveChanges() {
		// get the contents before save operation which may do auto-formatting
		const preSaveContent = await this.getDocumentText()
		if (!this.relPath || !this.absolutePath || !this.newContent || preSaveContent === undefined) {
			return {
				newProblemsMessage: undefined,
				userEdits: undefined,
				autoFormattingEdits: undefined,
				finalContent: undefined,
			}
		}
		await this.saveDocument()
		// get text after save in case there is any auto-formatting done by the editor
		const postSaveContent = (await this.getDocumentText()) || ""
		await HostProvider.window.showTextDocument({
			path: this.absolutePath,
			options: {
				preview: false,
				preserveFocus: true,
			},
		})
		await this.closeDiffView()
		const newProblems = await this.getNewDiagnosticProblems()
		const newProblemsMessage =
			newProblems.length > 0 ? `\n\nNew problems detected after saving the file:\n${newProblems}` : ""
		// If the edited content has different EOL characters, we don't want to show a diff with all the EOL differences.
		const newContentEOL = this.newContent.includes("\r\n") ? "\r\n" : "\n"
		const normalizedPreSaveContent = preSaveContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL // trimEnd to fix issue where editor adds in extra new line automatically
		const normalizedPostSaveContent = postSaveContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL // this is the final content we return to the model to use as the new baseline for future edits
		// just in case the new content has a mix of varying EOL characters
		const normalizedNewContent = this.newContent.replace(/\r\n|\n/g, newContentEOL).trimEnd() + newContentEOL
		let userEdits
		if (normalizedPreSaveContent !== normalizedNewContent) {
			// user made changes before approving edit. let the model know about user made changes (not including post-save auto-formatting changes)
			userEdits = formatResponse.createPrettyPatch(this.relPath.toPosix(), normalizedNewContent, normalizedPreSaveContent)
			// return { newProblemsMessage, userEdits, finalContent: normalizedPostSaveContent }
		} else {
			// no changes to cline's edits
			// return { newProblemsMessage, userEdits: undefined, finalContent: normalizedPostSaveContent }
		}
		let autoFormattingEdits
		if (normalizedPreSaveContent !== normalizedPostSaveContent) {
			// auto-formatting was done by the editor
			autoFormattingEdits = formatResponse.createPrettyPatch(
				this.relPath.toPosix(),
				normalizedPreSaveContent,
				normalizedPostSaveContent,
			)
		}
		return {
			newProblemsMessage,
			userEdits,
			autoFormattingEdits,
			finalContent: normalizedPostSaveContent,
		}
	}
	async revertChanges() {
		if (!this.absolutePath || !this.isEditing) {
			return
		}
		const fileExists = this.editType === "modify"
		if (!fileExists) {
			// This is a load-bearing save statement- even though the file is saved and then immediately deleted.
			// In vscode, it will not close the diff editor correctly if the file is not saved.
			await this.saveDocument()
			await this.closeDiffView()
			await fs.rm(this.absolutePath, { force: true })
			// Remove only the directories we created, in reverse order
			for (let i = this.createdDirs.length - 1; i >= 0; i--) {
				await fs.rmdir(this.createdDirs[i])
				console.log(`Directory ${this.createdDirs[i]} has been deleted.`)
			}
			console.log(`File ${this.absolutePath} has been deleted.`)
		} else {
			// revert document
			// Apply the edit and save, since contents shouldn't have changed this won't show in local history unless of
			// course the user made changes and saved during the edit.
			const contents = (await this.getDocumentText()) || ""
			const lineCount = (contents.match(/\n/g) || []).length + 1
			await this.replaceText(this.originalContent ?? "", { startLine: 0, endLine: lineCount }, undefined)
			await this.saveDocument()
			console.log(`File ${this.absolutePath} has been reverted to its original content.`)
			if (this.documentWasOpen) {
				await HostProvider.window.showTextDocument({
					path: this.absolutePath,
					options: {
						preview: false,
						preserveFocus: true,
					},
				})
			}
			await this.closeDiffView()
		}
		// edit is done
		await this.reset()
	}
	async scrollToFirstDiff() {
		if (!this.isEditing) {
			return
		}
		const currentContent = (await this.getDocumentText()) || ""
		const diffs = diff.diffLines(this.originalContent || "", currentContent)
		let lineCount = 0
		for (const part of diffs) {
			if (part.added || part.removed) {
				// Found the first diff, scroll to it
				this.scrollEditorToLine(lineCount)
				return
			}
			if (!part.removed) {
				lineCount += part.count || 0
			}
		}
	}
	// close editor if open?
	async reset() {
		this.editType = undefined
		this.isEditing = false
		this.originalContent = undefined
		this.createdDirs = []
		this.documentWasOpen = false
		this.streamedLines = []
		await this.resetDiffView()
	}
}
//# sourceMappingURL=DiffViewProvider.js.map
