import { DataSource } from "typeorm"
import path from "path"

// Models
import { User } from "@models/User"
import { Repository } from "@models/Repository"
import { Task } from "@models/Task"
import { Message } from "@models/Message"
import { FileChange } from "@models/FileChange"
import { Terminal } from "@models/Terminal"

const isDevelopment = process.env.NODE_ENV === "development"

export const AppDataSource = new DataSource({
	type: "sqlite",
	database: process.env.DATABASE_PATH || path.join(process.cwd(), "data", "cline.db"),
	synchronize: isDevelopment, // 生产环境应该使用 migrations
	logging: isDevelopment,
	entities: [User, Repository, Task, Message, FileChange, Terminal],
	migrations: [path.join(__dirname, "../migrations/*.ts")],
	subscribers: [path.join(__dirname, "../subscribers/*.ts")],
})

// 确保数据目录存在
import fs from "fs"
const dataDir = path.dirname(AppDataSource.options.database as string)
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true })
}
