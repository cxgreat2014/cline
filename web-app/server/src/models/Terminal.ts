import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm"
import { Repository } from "./Repository"
import { User } from "./User"

export enum TerminalStatus {
	ACTIVE = "active",
	INACTIVE = "inactive",
	CLOSED = "closed",
	ERROR = "error",
}

@Entity("terminals")
export class Terminal {
	@PrimaryGeneratedColumn("uuid")
	id: string

	@Column()
	sessionId: string

	@Column()
	name: string

	@Column({
		type: "simple-enum",
		enum: TerminalStatus,
		default: TerminalStatus.ACTIVE,
	})
	status: TerminalStatus

	@Column()
	workingDirectory: string

	@Column({ type: "json", nullable: true })
	environment: Record<string, string>

	@Column({ type: "json", nullable: true })
	settings: {
		cols: number
		rows: number
		shell: string
		encoding: string
	}

	@Column({ type: "text", nullable: true })
	lastOutput: string

	@Column({ nullable: true })
	lastActivityAt: Date

	@Column({ nullable: true })
	closedAt: Date

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	// Relations
	@ManyToOne(() => Repository, { onDelete: "CASCADE" })
	@JoinColumn({ name: "repositoryId" })
	repository: Repository

	@Column()
	repositoryId: string

	@ManyToOne(() => User)
	@JoinColumn({ name: "userId" })
	user: User

	@Column()
	userId: string

	// Methods
	updateActivity() {
		this.lastActivityAt = new Date()
	}

	close() {
		this.status = TerminalStatus.CLOSED
		this.closedAt = new Date()
	}

	markAsError() {
		this.status = TerminalStatus.ERROR
	}

	isActive(): boolean {
		return this.status === TerminalStatus.ACTIVE
	}

	isExpired(timeoutMs: number = 300000): boolean {
		if (!this.lastActivityAt) return false
		return Date.now() - this.lastActivityAt.getTime() > timeoutMs
	}
}
