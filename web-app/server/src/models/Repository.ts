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
import { Task } from "./Task"
import { FileChange } from "./FileChange"

export enum RepositoryStatus {
	ACTIVE = "active",
	INACTIVE = "inactive",
	ERROR = "error",
}

@Entity("repositories")
export class Repository {
	@PrimaryGeneratedColumn("uuid")
	id: string

	@Column({ type: "varchar" })
	name: string

	@Column({ type: "varchar", unique: true })
	path: string

	@Column({ type: "varchar", nullable: true })
	description: string

	@Column({
		type: "varchar",
		default: RepositoryStatus.ACTIVE,
	})
	status: RepositoryStatus

	@Column({ type: "json", nullable: true })
	gitInfo: {
		branch?: string
		remoteUrl?: string
		lastCommit?: string
		isDirty?: boolean
	}

	@Column({ type: "json", nullable: true })
	projectInfo: {
		language?: string
		framework?: string
		packageManager?: string
		dependencies?: string[]
	}

	@Column({ type: "json", default: "{}" })
	permissions: {
		read: boolean
		write: boolean
		execute: boolean
		admin: boolean
	}

	@Column({ type: "datetime", nullable: true })
	lastAccessedAt: Date

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	// Relations
	@ManyToOne(() => User, (user) => user.repositories)
	@JoinColumn({ name: "ownerId" })
	owner: User

	@Column({ type: "varchar" })
	ownerId: string

	@OneToMany(() => Task, (task) => task.repository)
	tasks: Task[]

	@OneToMany(() => FileChange, (fileChange) => fileChange.repository)
	fileChanges: FileChange[]

	// Methods
	updateLastAccessed() {
		this.lastAccessedAt = new Date()
	}

	hasPermission(permission: keyof Repository["permissions"]): boolean {
		return this.permissions[permission] || false
	}
}
