import fs from "fs/promises"
import path from "path"
import chokidar from "chokidar"
import { EventEmitter } from "events"
import { Repository } from "../models/Repository"
import { FileChange, FileChangeType } from "../models/FileChange"
import { AppDataSource } from "../config/database"

export interface FileInfo {
	name: string
	path: string
	relativePath: string
	type: "file" | "directory"
	size: number
	mimeType?: string
	lastModified: Date
	permissions?: string
}

export interface FileChangeEvent {
	type: "add" | "change" | "unlink" | "addDir" | "unlinkDir"
	path: string
	stats?: any
}

export class FileManager extends EventEmitter {
	private watchers = new Map<string, chokidar.FSWatcher>()
	private fileChangeRepository = AppDataSource.getRepository(FileChange)

	constructor() {
		super()
	}

	async readFile(repositoryPath: string, filePath: string): Promise<string> {
		const fullPath = this.getFullPath(repositoryPath, filePath)
		this.validatePath(repositoryPath, fullPath)

		try {
			const content = await fs.readFile(fullPath, "utf8")
			return content
		} catch (error) {
			throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async writeFile(
		repositoryPath: string,
		filePath: string,
		content: string,
		options?: { createBackup?: boolean; userId?: string; taskId?: string },
	): Promise<void> {
		const fullPath = this.getFullPath(repositoryPath, filePath)
		this.validatePath(repositoryPath, fullPath)

		try {
			// Read old content for backup/diff
			let oldContent = ""
			let changeType = FileChangeType.CREATED

			try {
				oldContent = await fs.readFile(fullPath, "utf8")
				changeType = FileChangeType.MODIFIED
			} catch {
				// File doesn't exist, it's a new file
			}

			// Create backup if requested
			if (options?.createBackup && changeType === FileChangeType.MODIFIED) {
				const backupPath = `${fullPath}.backup.${Date.now()}`
				await fs.writeFile(backupPath, oldContent)
			}

			// Ensure directory exists
			const dir = path.dirname(fullPath)
			await fs.mkdir(dir, { recursive: true })

			// Write the file
			await fs.writeFile(fullPath, content, "utf8")

			// Record the change
			await this.recordFileChange(repositoryPath, filePath, changeType, content, oldContent, options)

			// Emit change event
			this.emit("fileChanged", {
				type: "change",
				path: filePath,
				repositoryPath,
			})
		} catch (error) {
			throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async deleteFile(repositoryPath: string, filePath: string, options?: { userId?: string; taskId?: string }): Promise<void> {
		const fullPath = this.getFullPath(repositoryPath, filePath)
		this.validatePath(repositoryPath, fullPath)

		try {
			// Read content before deletion for backup
			let oldContent = ""
			try {
				const stats = await fs.stat(fullPath)
				if (stats.isFile()) {
					oldContent = await fs.readFile(fullPath, "utf8")
				}
			} catch {
				// File doesn't exist
				return
			}

			// Delete the file
			await fs.unlink(fullPath)

			// Record the change
			await this.recordFileChange(repositoryPath, filePath, FileChangeType.DELETED, "", oldContent, options)

			// Emit change event
			this.emit("fileChanged", {
				type: "unlink",
				path: filePath,
				repositoryPath,
			})
		} catch (error) {
			throw new Error(`Failed to delete file ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async listFiles(repositoryPath: string, relativePath: string = ""): Promise<FileInfo[]> {
		const fullPath = this.getFullPath(repositoryPath, relativePath)
		this.validatePath(repositoryPath, fullPath)

		try {
			const entries = await fs.readdir(fullPath, { withFileTypes: true })
			const files: FileInfo[] = []

			for (const entry of entries) {
				// Skip hidden files and common ignore patterns
				if (this.shouldIgnoreFile(entry.name)) {
					continue
				}

				const entryPath = path.join(fullPath, entry.name)
				const entryRelativePath = path.join(relativePath, entry.name)
				const stats = await fs.stat(entryPath)

				files.push({
					name: entry.name,
					path: entryPath,
					relativePath: entryRelativePath,
					type: entry.isDirectory() ? "directory" : "file",
					size: stats.size,
					lastModified: stats.mtime,
					permissions: stats.mode.toString(8),
				})
			}

			return files.sort((a, b) => {
				// Directories first, then files
				if (a.type !== b.type) {
					return a.type === "directory" ? -1 : 1
				}
				return a.name.localeCompare(b.name)
			})
		} catch (error) {
			throw new Error(`Failed to list files in ${relativePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	async fileExists(repositoryPath: string, filePath: string): Promise<boolean> {
		const fullPath = this.getFullPath(repositoryPath, filePath)
		this.validatePath(repositoryPath, fullPath)

		try {
			await fs.access(fullPath)
			return true
		} catch {
			return false
		}
	}

	async getFileStats(repositoryPath: string, filePath: string): Promise<FileInfo> {
		const fullPath = this.getFullPath(repositoryPath, filePath)
		this.validatePath(repositoryPath, fullPath)

		try {
			const stats = await fs.stat(fullPath)

			return {
				name: path.basename(filePath),
				path: fullPath,
				relativePath: filePath,
				type: stats.isDirectory() ? "directory" : "file",
				size: stats.size,
				lastModified: stats.mtime,
				permissions: stats.mode.toString(8),
			}
		} catch (error) {
			throw new Error(`Failed to get file stats for ${filePath}: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	watchRepository(repository: Repository, callback: (event: FileChangeEvent) => void): void {
		if (this.watchers.has(repository.id)) {
			return // Already watching
		}

		const watcher = chokidar.watch(repository.path, {
			ignored: [
				/(^|[\/\\])\../, // Hidden files
				/node_modules/,
				/\.git/,
				/dist/,
				/build/,
				/coverage/,
			],
			persistent: true,
			ignoreInitial: true,
		})

		watcher
			.on("add", (filePath, stats) => {
				const relativePath = path.relative(repository.path, filePath)
				callback({ type: "add", path: relativePath, stats })
			})
			.on("change", (filePath, stats) => {
				const relativePath = path.relative(repository.path, filePath)
				callback({ type: "change", path: relativePath, stats })
			})
			.on("unlink", (filePath) => {
				const relativePath = path.relative(repository.path, filePath)
				callback({ type: "unlink", path: relativePath })
			})
			.on("addDir", (dirPath, stats) => {
				const relativePath = path.relative(repository.path, dirPath)
				callback({ type: "addDir", path: relativePath, stats })
			})
			.on("unlinkDir", (dirPath) => {
				const relativePath = path.relative(repository.path, dirPath)
				callback({ type: "unlinkDir", path: relativePath })
			})

		this.watchers.set(repository.id, watcher)
	}

	stopWatching(repositoryId: string): void {
		const watcher = this.watchers.get(repositoryId)
		if (watcher) {
			watcher.close()
			this.watchers.delete(repositoryId)
		}
	}

	private getFullPath(repositoryPath: string, filePath: string): string {
		if (path.isAbsolute(filePath)) {
			return filePath
		}
		return path.join(repositoryPath, filePath)
	}

	private validatePath(repositoryPath: string, targetPath: string): void {
		const resolvedRepo = path.resolve(repositoryPath)
		const resolvedTarget = path.resolve(targetPath)

		if (!resolvedTarget.startsWith(resolvedRepo)) {
			throw new Error("Access denied: path outside repository bounds")
		}
	}

	private shouldIgnoreFile(fileName: string): boolean {
		const ignorePatterns = [
			/^\./, // Hidden files
			/~$/, // Backup files
			/\.tmp$/, // Temporary files
			/\.log$/, // Log files
			/node_modules/, // Dependencies
			/\.git/, // Git files
			/dist/, // Build output
			/build/, // Build output
			/coverage/, // Test coverage
		]

		return ignorePatterns.some((pattern) => pattern.test(fileName))
	}

	private async recordFileChange(
		repositoryPath: string,
		filePath: string,
		changeType: FileChangeType,
		content: string,
		oldContent: string,
		options?: { userId?: string; taskId?: string },
	): Promise<void> {
		try {
			const repository = await AppDataSource.getRepository(Repository).findOne({ where: { path: repositoryPath } })

			if (!repository) {
				return // Repository not found in database
			}

			const fileChange = new FileChange()
			fileChange.repositoryId = repository.id
			fileChange.filePath = filePath
			fileChange.changeType = changeType
			fileChange.content = content
			fileChange.oldContent = oldContent
			fileChange.userId = options?.userId || null
			fileChange.taskId = options?.taskId || null

			// Calculate diff for modifications
			if (changeType === FileChangeType.MODIFIED && oldContent && content) {
				fileChange.calculateDiff(oldContent, content)
			}

			await this.fileChangeRepository.save(fileChange)
		} catch (error) {
			console.error("Failed to record file change:", error)
			// Don't throw error to avoid breaking file operations
		}
	}

	async cleanup(): Promise<void> {
		// Close all watchers
		for (const [repositoryId, watcher] of this.watchers) {
			watcher.close()
		}
		this.watchers.clear()
	}
}
