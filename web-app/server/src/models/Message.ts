import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Task } from "./Task"
import { User } from "./User"

export enum MessageType {
	USER = "user",
	ASSISTANT = "assistant",
	SYSTEM = "system",
	TOOL_USE = "tool_use",
	TOOL_RESULT = "tool_result",
	ERROR = "error",
}

export enum MessageStatus {
	PENDING = "pending",
	PROCESSING = "processing",
	COMPLETED = "completed",
	FAILED = "failed",
}

@Entity("messages")
export class Message {
	@PrimaryGeneratedColumn("uuid")
	id: string

	@Column({
		type: "simple-enum",
		enum: MessageType,
	})
	type: MessageType

	@Column({ type: "text" })
	content: string

	@Column({
		type: "simple-enum",
		enum: MessageStatus,
		default: MessageStatus.COMPLETED,
	})
	status: MessageStatus

	@Column({ type: "json", nullable: true })
	metadata: {
		toolName?: string
		toolParameters?: any
		toolResult?: any
		images?: string[]
		files?: string[]
		mentions?: string[]
		error?: string
		executionTime?: number
	}

	@Column({ default: 0 })
	sequence: number

	@CreateDateColumn()
	createdAt: Date

	@Column({ nullable: true })
	completedAt: Date

	// Relations
	@ManyToOne(() => Task, (task) => task.messages, { onDelete: "CASCADE" })
	@JoinColumn({ name: "taskId" })
	task: Task

	@Column()
	taskId: string

	@ManyToOne(() => User, { nullable: true })
	@JoinColumn({ name: "userId" })
	user: User

	@Column({ nullable: true })
	userId: string

	// Methods
	markAsProcessing() {
		this.status = MessageStatus.PROCESSING
	}

	markAsCompleted() {
		this.status = MessageStatus.COMPLETED
		this.completedAt = new Date()
	}

	markAsFailed(error: string) {
		this.status = MessageStatus.FAILED
		this.completedAt = new Date()
		if (!this.metadata) {
			this.metadata = {}
		}
		this.metadata.error = error
	}

	addMetadata(key: string, value: any) {
		if (!this.metadata) {
			this.metadata = {}
		}
		this.metadata[key] = value
	}
}
