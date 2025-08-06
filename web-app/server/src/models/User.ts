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

	@Column({ unique: true })
	username: string

	@Column({ unique: true })
	email: string

	@Column()
	passwordHash: string

	@Column({
		type: "simple-enum",
		enum: UserRole,
		default: UserRole.USER,
	})
	role: UserRole

	@Column({ default: true })
	isActive: boolean

	@Column({ nullable: true })
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
