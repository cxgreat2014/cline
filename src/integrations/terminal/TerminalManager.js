import pWaitFor from "p-wait-for"
import * as vscode from "vscode"
import { arePathsEqual } from "@utils/path"
import { getShellForProfile } from "@utils/shell"
import { mergePromise, TerminalProcess } from "./TerminalProcess"
import { TerminalRegistry } from "./TerminalRegistry"
export class TerminalManager {
	terminalIds = new Set()
	processes = new Map()
	disposables = []
	shellIntegrationTimeout = 4000
	terminalReuseEnabled = true
	terminalOutputLineLimit = 500
	defaultTerminalProfile = "default"
	constructor() {
		let disposable
		try {
			disposable = vscode.window.onDidStartTerminalShellExecution?.(async (e) => {
				// Creating a read stream here results in a more consistent output. This is most obvious when running the `date` command.
				e?.execution?.read()
			})
		} catch (error) {
			// console.error("Error setting up onDidEndTerminalShellExecution", error)
		}
		if (disposable) {
			this.disposables.push(disposable)
		}
		// Add a listener for terminal state changes to detect CWD updates
		try {
			const stateChangeDisposable = vscode.window.onDidChangeTerminalState((terminal) => {
				const terminalInfo = this.findTerminalInfoByTerminal(terminal)
				if (terminalInfo && terminalInfo.pendingCwdChange && terminalInfo.cwdResolved) {
					// Check if CWD has been updated to match the expected path
					if (this.isCwdMatchingExpected(terminalInfo)) {
						const resolver = terminalInfo.cwdResolved.resolve
						terminalInfo.pendingCwdChange = undefined
						terminalInfo.cwdResolved = undefined
						resolver()
					}
				}
			})
			this.disposables.push(stateChangeDisposable)
		} catch (error) {
			console.error("Error setting up onDidChangeTerminalState", error)
		}
	}
	//Find a TerminalInfo by its VSCode Terminal instance
	findTerminalInfoByTerminal(terminal) {
		const terminals = TerminalRegistry.getAllTerminals()
		return terminals.find((t) => t.terminal === terminal)
	}
	//Check if a terminal's CWD matches its expected pending change
	isCwdMatchingExpected(terminalInfo) {
		if (!terminalInfo.pendingCwdChange) {
			return false
		}
		const currentCwd = terminalInfo.terminal.shellIntegration?.cwd?.fsPath
		const targetCwd = vscode.Uri.file(terminalInfo.pendingCwdChange).fsPath
		if (!currentCwd) {
			return false
		}
		return arePathsEqual(currentCwd, targetCwd)
	}
	runCommand(terminalInfo, command) {
		console.log(`[TerminalManager] Running command on terminal ${terminalInfo.id}: "${command}"`)
		console.log(`[TerminalManager] Terminal ${terminalInfo.id} busy state before: ${terminalInfo.busy}`)
		terminalInfo.busy = true
		terminalInfo.lastCommand = command
		const process = new TerminalProcess()
		this.processes.set(terminalInfo.id, process)
		process.once("completed", () => {
			console.log(`[TerminalManager] Terminal ${terminalInfo.id} completed, setting busy to false`)
			terminalInfo.busy = false
		})
		// if shell integration is not available, remove terminal so it does not get reused as it may be running a long-running process
		process.once("no_shell_integration", () => {
			console.log(`no_shell_integration received for terminal ${terminalInfo.id}`)
			// Remove the terminal so we can't reuse it (in case it's running a long-running process)
			TerminalRegistry.removeTerminal(terminalInfo.id)
			this.terminalIds.delete(terminalInfo.id)
			this.processes.delete(terminalInfo.id)
		})
		const promise = new Promise((resolve, reject) => {
			process.once("continue", () => {
				resolve()
			})
			process.once("error", (error) => {
				console.error(`Error in terminal ${terminalInfo.id}:`, error)
				reject(error)
			})
		})
		// if shell integration is already active, run the command immediately
		if (terminalInfo.terminal.shellIntegration) {
			process.waitForShellIntegration = false
			process.run(terminalInfo.terminal, command)
		} else {
			// docs recommend waiting 3s for shell integration to activate
			console.log(
				`[TerminalManager Test] Waiting for shell integration for terminal ${terminalInfo.id} with timeout ${this.shellIntegrationTimeout}ms`,
			)
			pWaitFor(() => terminalInfo.terminal.shellIntegration !== undefined, {
				timeout: this.shellIntegrationTimeout,
			})
				.then(() => {
					console.log(
						`[TerminalManager Test] Shell integration activated for terminal ${terminalInfo.id} within timeout.`,
					)
				})
				.catch((err) => {
					console.warn(
						`[TerminalManager Test] Shell integration timed out or failed for terminal ${terminalInfo.id}: ${err.message}`,
					)
				})
				.finally(() => {
					console.log(`[TerminalManager Test] Proceeding with command execution for terminal ${terminalInfo.id}.`)
					const existingProcess = this.processes.get(terminalInfo.id)
					if (existingProcess && existingProcess.waitForShellIntegration) {
						existingProcess.waitForShellIntegration = false
						existingProcess.run(terminalInfo.terminal, command)
					}
				})
		}
		return mergePromise(process, promise)
	}
	async getOrCreateTerminal(cwd) {
		const terminals = TerminalRegistry.getAllTerminals()
		const expectedShellPath =
			this.defaultTerminalProfile !== "default" ? getShellForProfile(this.defaultTerminalProfile) : undefined
		// Find available terminal from our pool first (created for this task)
		console.log(`[TerminalManager] Looking for terminal in cwd: ${cwd}`)
		console.log(`[TerminalManager] Available terminals: ${terminals.length}`)
		const matchingTerminal = terminals.find((t) => {
			if (t.busy) {
				console.log(`[TerminalManager] Terminal ${t.id} is busy, skipping`)
				return false
			}
			// Check if shell path matches current configuration
			if (t.shellPath !== expectedShellPath) {
				return false
			}
			const terminalCwd = t.terminal.shellIntegration?.cwd // one of cline's commands could have changed the cwd of the terminal
			if (!terminalCwd) {
				console.log(`[TerminalManager] Terminal ${t.id} has no cwd, skipping`)
				return false
			}
			const matches = arePathsEqual(vscode.Uri.file(cwd).fsPath, terminalCwd.fsPath)
			console.log(`[TerminalManager] Terminal ${t.id} cwd: ${terminalCwd.fsPath}, matches: ${matches}`)
			return matches
		})
		if (matchingTerminal) {
			console.log(`[TerminalManager] Found matching terminal ${matchingTerminal.id} in correct cwd`)
			this.terminalIds.add(matchingTerminal.id)
			return matchingTerminal
		}
		// If no non-busy terminal in the current working dir exists and terminal reuse is enabled, try to find any non-busy terminal regardless of CWD
		if (this.terminalReuseEnabled) {
			const availableTerminal = terminals.find((t) => !t.busy && t.shellPath === expectedShellPath)
			if (availableTerminal) {
				// Set up promise and tracking for CWD change
				const cwdPromise = new Promise((resolve, reject) => {
					availableTerminal.pendingCwdChange = cwd
					availableTerminal.cwdResolved = { resolve, reject }
				})
				// Navigate back to the desired directory
				const cdProcess = this.runCommand(availableTerminal, `cd "${cwd}"`)
				// Wait for the cd command to complete before proceeding
				await cdProcess
				// Add a small delay to ensure terminal is ready after cd
				await new Promise((resolve) => setTimeout(resolve, 100))
				// Either resolve immediately if CWD already updated or wait for event/timeout
				if (this.isCwdMatchingExpected(availableTerminal)) {
					if (availableTerminal.cwdResolved) {
						availableTerminal.cwdResolved.resolve()
					}
					availableTerminal.pendingCwdChange = undefined
					availableTerminal.cwdResolved = undefined
				} else {
					try {
						// Wait with a timeout for state change event to resolve
						await Promise.race([
							cwdPromise,
							new Promise((_, reject) =>
								setTimeout(() => reject(new Error(`CWD timeout: Failed to update to ${cwd}`)), 1000),
							),
						])
					} catch (err) {
						// Clear pending state on timeout
						availableTerminal.pendingCwdChange = undefined
						availableTerminal.cwdResolved = undefined
					}
				}
				this.terminalIds.add(availableTerminal.id)
				return availableTerminal
			}
		}
		// If all terminals are busy or don't match shell profile, create a new one with the configured shell
		const newTerminalInfo = TerminalRegistry.createTerminal(cwd, expectedShellPath)
		this.terminalIds.add(newTerminalInfo.id)
		return newTerminalInfo
	}
	getTerminals(busy) {
		return Array.from(this.terminalIds)
			.map((id) => TerminalRegistry.getTerminal(id))
			.filter((t) => t !== undefined && t.busy === busy)
			.map((t) => ({ id: t.id, lastCommand: t.lastCommand }))
	}
	getUnretrievedOutput(terminalId) {
		if (!this.terminalIds.has(terminalId)) {
			return ""
		}
		const process = this.processes.get(terminalId)
		return process ? process.getUnretrievedOutput() : ""
	}
	isProcessHot(terminalId) {
		const process = this.processes.get(terminalId)
		return process ? process.isHot : false
	}
	disposeAll() {
		// for (const info of this.terminals) {
		// 	//info.terminal.dispose() // dont want to dispose terminals when task is aborted
		// }
		this.terminalIds.clear()
		this.processes.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
	}
	setShellIntegrationTimeout(timeout) {
		this.shellIntegrationTimeout = timeout
	}
	setTerminalReuseEnabled(enabled) {
		this.terminalReuseEnabled = enabled
	}
	setTerminalOutputLineLimit(limit) {
		this.terminalOutputLineLimit = limit
	}
	processOutput(outputLines) {
		if (outputLines.length > this.terminalOutputLineLimit) {
			const halfLimit = Math.floor(this.terminalOutputLineLimit / 2)
			const start = outputLines.slice(0, halfLimit)
			const end = outputLines.slice(outputLines.length - halfLimit)
			return `${start.join("\n")}\n... (output truncated) ...\n${end.join("\n")}`.trim()
		}
		return outputLines.join("\n").trim()
	}
	setDefaultTerminalProfile(profileId) {
		// Only handle terminal change if profile actually changed
		if (this.defaultTerminalProfile === profileId) {
			return { closedCount: 0, busyTerminals: [] }
		}
		const oldProfileId = this.defaultTerminalProfile
		this.defaultTerminalProfile = profileId
		// Get the shell path for the new profile
		const newShellPath = profileId !== "default" ? getShellForProfile(profileId) : undefined
		// Handle terminal management for the profile change
		const result = this.handleTerminalProfileChange(newShellPath)
		// Update lastActive for any remaining terminals
		const allTerminals = TerminalRegistry.getAllTerminals()
		allTerminals.forEach((terminal) => {
			if (terminal.shellPath !== newShellPath) {
				TerminalRegistry.updateTerminal(terminal.id, { lastActive: Date.now() })
			}
		})
		return result
	}
	/**
	 * Filters terminals based on a provided criteria function
	 * @param filterFn Function that accepts TerminalInfo and returns boolean
	 * @returns Array of terminals that match the criteria
	 */
	filterTerminals(filterFn) {
		const terminals = TerminalRegistry.getAllTerminals()
		return terminals.filter(filterFn)
	}
	/**
	 * Closes terminals that match the provided criteria
	 * @param filterFn Function that accepts TerminalInfo and returns boolean for terminals to close
	 * @param force If true, closes even busy terminals (with warning)
	 * @returns Number of terminals closed
	 */
	closeTerminals(filterFn, force = false) {
		const terminalsToClose = this.filterTerminals(filterFn)
		let closedCount = 0
		for (const terminalInfo of terminalsToClose) {
			// Skip busy terminals unless force is true
			if (terminalInfo.busy && !force) {
				continue
			}
			// Remove from our tracking
			if (this.terminalIds.has(terminalInfo.id)) {
				this.terminalIds.delete(terminalInfo.id)
			}
			this.processes.delete(terminalInfo.id)
			// Dispose the actual terminal
			terminalInfo.terminal.dispose()
			// Remove from registry
			TerminalRegistry.removeTerminal(terminalInfo.id)
			closedCount++
		}
		return closedCount
	}
	/**
	 * Handles terminal management when the terminal profile changes
	 * @param newShellPath New shell path to use
	 * @returns Object with information about closed terminals and remaining busy terminals
	 */
	handleTerminalProfileChange(newShellPath) {
		// Close non-busy terminals with different shell path
		const closedCount = this.closeTerminals((terminal) => !terminal.busy && terminal.shellPath !== newShellPath, false)
		// Get remaining busy terminals with different shell path
		const busyTerminals = this.filterTerminals((terminal) => terminal.busy && terminal.shellPath !== newShellPath)
		return {
			closedCount,
			busyTerminals,
		}
	}
	/**
	 * Forces closure of all terminals (including busy ones)
	 * @returns Number of terminals closed
	 */
	closeAllTerminals() {
		return this.closeTerminals(() => true, true)
	}
}
//# sourceMappingURL=TerminalManager.js.map
