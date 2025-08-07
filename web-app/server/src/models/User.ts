import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from "typeorm"
import { Repository } from "./Repository"
import { Task } from "./Task"

export enum UserRole {
	ADMIN = "admin",
	USER = "user",
	VIEWER = "viewer",
}

@Entity("users")
export class User {
	@PrimaryGeneratedColumn("uuid")
	id: string

	@Column({ type: "varchar", unique: true })
	username: string

	@Column({ type: "varchar", unique: true })
	email: string

	@Column({ type: "varchar" })
	passwordHash: string

	@Column({
		type: "varchar",
		default: UserRole.USER,
	})
	role: UserRole

	@Column({ type: "boolean", default: true })
	isActive: boolean

	@Column({ type: "datetime", nullable: true })
	lastLoginAt: Date

	@Column({ type: "json", nullable: true })
	preferences: {
		theme?: "light" | "dark"
		language?: string
		autoApproval?: boolean
		notifications?: boolean
	}

	@CreateDateColumn()
	createdAt: Date

	@UpdateDateColumn()
	updatedAt: Date

	// Relations
	@OneToMany(() => Repository, (repository) => repository.owner)
	repositories: Repository[]

	@OneToMany(() => Task, (task) => task.user)
	tasks: Task[]

	// Methods
	toJSON() {
		const { passwordHash, ...result } = this
		return result
	}
}
