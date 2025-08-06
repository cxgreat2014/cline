import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	ManyToOne,
	OneToMany,
	JoinColumn,
} from "typeorm"
import { User } from "./User"
import { Repository } from "./Repository"
import { Message } from "./Message"

export enum TaskStatus {
	PENDING = "pending",
	RUNNING = "running",
	COMPLETED = "completed",
	FAILED = "failed",
	CANCELLED = "cancelled",
}

export enum TaskMode {
	PLAN = "plan",
	ACT = "act",
}

@Entity("tasks")
export class Task {
	@PrimaryGeneratedColumn("uuid")
	id: string

	@Column()
	title: string

	@Column({ type: "text", nullable: true })
	description: string

	@Column({
		type: "simple-enum",
		enum: TaskStatus,
		default: TaskStatus.PENDING,
	})
	status: TaskStatus

	@Column({
		type: "simple-enum",
		enum: TaskMode,
		default: TaskMode.ACT,
	})
	mode: TaskMode

	@Column({ type: "json", nullable: true })
	context: {
		files?: string[]
		images?: string[]
		mentions?: string[]
		environment?: Record<string, any>
	}

	@Column({ type: "json", nullable: true })
	result: {
		filesChanged?: string[]
		commandsExecuted?: string[]
		errors?: string[]
		summary?: string
	}

	@Column({ type: "json", nullable: true })
	checkpoints: {
		id: string
		timestamp: Date
		description: string
		gitCommit?: string
	}[]

	@Column({ default: 0 })
	messageCount: number

	@Column({ nullable: true })
	startedAt: Date

	@Column({ nullable: true })
	completedAt: Date

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	// Relations
	@ManyToOne(() => User, (user) => user.tasks)
	@JoinColumn({ name: "userId" })
	user: User

	@Column()
	userId: string

	@ManyToOne(() => Repository, (repository) => repository.tasks)
	@JoinColumn({ name: "repositoryId" })
	repository: Repository

	@Column()
	repositoryId: string

	@OneToMany(() => Message, (message) => message.task)
	messages: Message[]

	// Methods
	start() {
		this.status = TaskStatus.RUNNING
		this.startedAt = new Date()
	}

	complete(result?: Task["result"]) {
		this.status = TaskStatus.COMPLETED
		this.completedAt = new Date()
		if (result) {
			this.result = result
		}
	}

	fail(error: string) {
		this.status = TaskStatus.FAILED
		this.completedAt = new Date()
		if (!this.result) {
			this.result = {}
		}
		if (!this.result.errors) {
			this.result.errors = []
		}
		this.result.errors.push(error)
	}

	cancel() {
		this.status = TaskStatus.CANCELLED
		this.completedAt = new Date()
	}

	addCheckpoint(description: string, gitCommit?: string) {
		if (!this.checkpoints) {
			this.checkpoints = []
		}
		this.checkpoints.push({
			id: `checkpoint-${Date.now()}`,
			timestamp: new Date(),
			description,
			gitCommit,
		})
	}

	getDuration(): number | null {
		if (!this.startedAt) return null
		const endTime = this.completedAt || new Date()
		return endTime.getTime() - this.startedAt.getTime()
	}
}
