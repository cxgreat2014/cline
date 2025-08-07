import { Router } from "express"
import path from "path"
import fs from "fs/promises"
import Joi from "joi"
import { Repository, RepositoryStatus } from "../models/Repository"
import { AppDataSource } from "../config/database"
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth"
import { asyncHandler, ValidationError, NotFoundError, ForbiddenError, ConflictError } from "../middleware/errorHandler"
import { FileManager } from "../services/FileManager"
import simpleGit from "simple-git"

const router = Router()
const repositoryRepository = AppDataSource.getRepository(Repository)
const fileManager = new FileManager()

// Validation schemas
const createRepositorySchema = Joi.object({
	name: Joi.string().min(1).max(100).required(),
	path: Joi.string().required(),
	description: Joi.string().max(500).optional(),
})

const updateRepositorySchema = Joi.object({
	name: Joi.string().min(1).max(100),
	description: Joi.string().max(500).allow(""),
	permissions: Joi.object({
		read: Joi.boolean(),
		write: Joi.boolean(),
		execute: Joi.boolean(),
		admin: Joi.boolean(),
	}),
})

// Get all repositories for current user
router.get(
	"/",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const repositories = await repositoryRepository.find({
			where: { ownerId: req.user!.id },
			order: { lastAccessedAt: "DESC", createdAt: "DESC" },
		})

		// Update git info for each repository
		const repositoriesWithGitInfo = await Promise.all(
			repositories.map(async (repo) => {
				try {
					const gitInfo = await getGitInfo(repo.path)
					repo.gitInfo = gitInfo
					await repositoryRepository.save(repo)
				} catch (error) {
					console.warn(`Failed to get git info for ${repo.path}:`, error)
				}
				return repo
			}),
		)

		res.json({
			success: true,
			data: {
				repositories: repositoriesWithGitInfo,
			},
		})
	}),
)

// Get repository by ID
router.get(
	"/:id",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const repository = await repositoryRepository.findOne({
			where: { id: req.params.id, ownerId: req.user!.id },
			relations: ["tasks"],
		})

		if (!repository) {
			throw new NotFoundError("Repository not found")
		}

		// Update last accessed time
		repository.updateLastAccessed()
		await repositoryRepository.save(repository)

		// Get updated git info
		try {
			const gitInfo = await getGitInfo(repository.path)
			repository.gitInfo = gitInfo
			await repositoryRepository.save(repository)
		} catch (error) {
			console.warn(`Failed to get git info for ${repository.path}:`, error)
		}

		res.json({
			success: true,
			data: {
				repository,
			},
		})
	}),
)

// Create new repository
router.post(
	"/",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { error, value } = createRepositorySchema.validate(req.body)
		if (error) {
			throw new ValidationError("Invalid repository data", error.details)
		}

		const { name, path: repoPath, description } = value
		const userId = req.user!.id

		// Validate path exists and is accessible
		try {
			const resolvedPath = path.resolve(repoPath)
			const stats = await fs.stat(resolvedPath)

			if (!stats.isDirectory()) {
				throw new ValidationError("Path must be a directory")
			}

			// Check if repository already exists
			const existingRepo = await repositoryRepository.findOne({
				where: { path: resolvedPath },
			})

			if (existingRepo) {
				throw new ConflictError("Repository with this path already exists")
			}

			// Create repository record
			const repository = new Repository()
			repository.name = name
			repository.path = resolvedPath
			repository.description = description || ""
			repository.ownerId = userId
			repository.status = RepositoryStatus.ACTIVE
			repository.permissions = {
				read: true,
				write: true,
				execute: false,
				admin: true,
			}

			// Get git info if it's a git repository
			try {
				const gitInfo = await getGitInfo(resolvedPath)
				repository.gitInfo = gitInfo
			} catch (error) {
				// Not a git repository or git error, that's okay
				repository.gitInfo = {}
			}

			// Detect project info
			try {
				const projectInfo = await detectProjectInfo(resolvedPath)
				repository.projectInfo = projectInfo
			} catch (error) {
				repository.projectInfo = {}
			}

			await repositoryRepository.save(repository)

			// Start watching for file changes
			fileManager.watchRepository(repository, (event) => {
				// Handle file change events
				console.log(`File change in ${repository.name}:`, event)
			})

			res.status(201).json({
				success: true,
				data: {
					repository,
				},
			})
		} catch (error) {
			if (error instanceof Error && error.message.includes("ENOENT")) {
				throw new ValidationError("Path does not exist")
			} else if (error instanceof Error && error.message.includes("EACCES")) {
				throw new ValidationError("Access denied to path")
			}
			throw error
		}
	}),
)

// Update repository
router.put(
	"/:id",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const { error, value } = updateRepositorySchema.validate(req.body)
		if (error) {
			throw new ValidationError("Invalid repository data", error.details)
		}

		const repository = await repositoryRepository.findOne({
			where: { id: req.params.id, ownerId: req.user!.id },
		})

		if (!repository) {
			throw new NotFoundError("Repository not found")
		}

		const { name, description, permissions } = value

		if (name) repository.name = name
		if (description !== undefined) repository.description = description
		if (permissions) repository.permissions = { ...repository.permissions, ...permissions }

		await repositoryRepository.save(repository)

		res.json({
			success: true,
			data: {
				repository,
			},
		})
	}),
)

// Delete repository
router.delete(
	"/:id",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const repository = await repositoryRepository.findOne({
			where: { id: req.params.id, ownerId: req.user!.id },
		})

		if (!repository) {
			throw new NotFoundError("Repository not found")
		}

		// Stop watching file changes
		fileManager.stopWatching(repository.id)

		// Delete repository record (cascade will handle related records)
		await repositoryRepository.remove(repository)

		res.json({
			success: true,
			message: "Repository deleted successfully",
		})
	}),
)

// Get repository status
router.get(
	"/:id/status",
	authMiddleware,
	asyncHandler(async (req: AuthenticatedRequest, res) => {
		const repository = await repositoryRepository.findOne({
			where: { id: req.params.id, ownerId: req.user!.id },
		})

		if (!repository) {
			throw new NotFoundError("Repository not found")
		}

		try {
			// Check if path still exists
			await fs.access(repository.path)

			// Get updated git info
			const gitInfo = await getGitInfo(repository.path)
			repository.gitInfo = gitInfo
			repository.status = RepositoryStatus.ACTIVE

			await repositoryRepository.save(repository)

			res.json({
				success: true,
				data: {
					status: repository.status,
					gitInfo: repository.gitInfo,
					accessible: true,
				},
			})
		} catch (error) {
			repository.status = RepositoryStatus.ERROR
			await repositoryRepository.save(repository)

			res.json({
				success: true,
				data: {
					status: repository.status,
					accessible: false,
					error: error instanceof Error ? error.message : "Unknown error",
				},
			})
		}
	}),
)

// Helper functions
async function getGitInfo(repoPath: string) {
	const git = simpleGit(repoPath)

	try {
		const isRepo = await git.checkIsRepo()
		if (!isRepo) {
			return {}
		}

		const [branch, remotes, status, log] = await Promise.all([
			git.branch().catch(() => null),
			git.getRemotes(true).catch(() => []),
			git.status().catch(() => null),
			git.log({ maxCount: 1 }).catch(() => null),
		])

		return {
			branch: branch?.current || "unknown",
			remoteUrl: remotes[0]?.refs?.fetch || null,
			lastCommit: log?.latest?.hash || null,
			isDirty: status ? !status.isClean() : false,
		}
	} catch (error) {
		return {}
	}
}

async function detectProjectInfo(repoPath: string) {
	const projectInfo: any = {}

	try {
		// Check for package.json (Node.js)
		const packageJsonPath = path.join(repoPath, "package.json")
		try {
			const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"))
			projectInfo.language = "javascript"
			projectInfo.packageManager = "npm"

			if (packageJson.dependencies?.react) {
				projectInfo.framework = "react"
			} else if (packageJson.dependencies?.vue) {
				projectInfo.framework = "vue"
			} else if (packageJson.dependencies?.angular) {
				projectInfo.framework = "angular"
			} else if (packageJson.dependencies?.express) {
				projectInfo.framework = "express"
			}

			projectInfo.dependencies = Object.keys(packageJson.dependencies || {})
		} catch {}

		// Check for requirements.txt (Python)
		const requirementsPath = path.join(repoPath, "requirements.txt")
		try {
			await fs.access(requirementsPath)
			projectInfo.language = "python"
			projectInfo.packageManager = "pip"
		} catch {}

		// Check for Cargo.toml (Rust)
		const cargoPath = path.join(repoPath, "Cargo.toml")
		try {
			await fs.access(cargoPath)
			projectInfo.language = "rust"
			projectInfo.packageManager = "cargo"
		} catch {}

		// Check for go.mod (Go)
		const goModPath = path.join(repoPath, "go.mod")
		try {
			await fs.access(goModPath)
			projectInfo.language = "go"
			projectInfo.packageManager = "go"
		} catch {}
	} catch (error) {
		console.warn("Error detecting project info:", error)
	}

	return projectInfo
}

export default router
