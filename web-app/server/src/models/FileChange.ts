import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Repository } from "./Repository"
import { Task } from "./Task"
import { User } from "./User"

export enum FileChangeType {
	CREATED = "created",
	MODIFIED = "modified",
	DELETED = "deleted",
	RENAMED = "renamed",
}

@Entity("file_changes")
export class FileChange {
	@PrimaryGeneratedColumn("uuid")
	id: string

	@Column({ type: "varchar" })
	filePath: string

	@Column({ type: "varchar", nullable: true })
	oldFilePath: string // For rename operations

	@Column({
		type: "varchar",
	})
	changeType: FileChangeType

	@Column({ type: "text", nullable: true })
	content: string

	@Column({ type: "text", nullable: true })
	oldContent: string

	@Column({ type: "json", nullable: true })
	diff: {
		additions: number
		deletions: number
		changes: Array<{
			type: "add" | "remove" | "modify"
			lineNumber: number
			content: string
		}>
	}

	@Column({ type: "varchar", nullable: true })
	gitCommit: string

	@Column({ type: "json", nullable: true })
	metadata: {
		fileSize?: number
		mimeType?: string
		encoding?: string
		permissions?: string
		isDirectory?: boolean
	}

	@CreateDateColumn()
	createdAt: Date

	// Relations
	@ManyToOne(() => Repository, (repository) => repository.fileChanges, { onDelete: "CASCADE" })
	@JoinColumn({ name: "repositoryId" })
	repository: Repository

	@Column({ type: "varchar" })
	repositoryId: string

	@ManyToOne(() => Task, { nullable: true, onDelete: "SET NULL" })
	@JoinColumn({ name: "taskId" })
	task: Task

	@Column({ type: "varchar", nullable: true })
	taskId: string

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: "userId" })
	user: User

	@Column({ type: "varchar", nullable: true })
	userId: string

	// Methods
	calculateDiff(oldContent: string, newContent: string) {
		// Simple diff calculation - in production, use a proper diff library
		const oldLines = oldContent.split("\n")
		const newLines = newContent.split("\n")

		let additions = 0
		let deletions = 0
		const changes: any[] = []

		// Simple line-by-line comparison
		const maxLines = Math.max(oldLines.length, newLines.length)

		for (let i = 0; i < maxLines; i++) {
			const oldLine = oldLines[i]
			const newLine = newLines[i]

			if (oldLine === undefined) {
				// Line added
				additions++
				changes.push({
					type: "add",
					lineNumber: i + 1,
					content: newLine,
				})
			} else if (newLine === undefined) {
				// Line deleted
				deletions++
				changes.push({
					type: "remove",
					lineNumber: i + 1,
					content: oldLine,
				})
			} else if (oldLine !== newLine) {
				// Line modified
				changes.push({
					type: "modify",
					lineNumber: i + 1,
					content: newLine,
				})
			}
		}

		this.diff = {
			additions,
			deletions,
			changes,
		}
	}

	getRelativePath(repositoryPath: string): string {
		if (this.filePath.startsWith(repositoryPath)) {
			return this.filePath.substring(repositoryPath.length + 1)
		}
		return this.filePath
	}
}
