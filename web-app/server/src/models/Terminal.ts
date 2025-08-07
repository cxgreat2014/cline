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

	@Column({ type: "varchar" })
	sessionId: string

	@Column({ type: "varchar" })
	name: string

	@Column({
		type: "varchar",
		default: TerminalStatus.ACTIVE,
	})
	status: TerminalStatus

	@Column({ type: "varchar" })
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

	@Column({ type: "datetime", nullable: true })
	lastActivityAt: Date

	@Column({ type: "datetime", nullable: true })
	closedAt: Date

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	// Relations
	@ManyToOne(() => Repository, { onDelete: "CASCADE" })
	@JoinColumn({ name: "repositoryId" })
	repository: Repository

	@Column({ type: "varchar" })
	repositoryId: string

	@ManyToOne(() => User)
	@JoinColumn({ name: "userId" })
	user: User

	@Column({ type: "varchar" })
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
