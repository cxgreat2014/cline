import { create } from "zustand"
import { repositoryService } from "@services/repositoryService"

export interface Repository {
	id: string
	name: string
	path: string
	description: string
	status: "active" | "inactive" | "error"
	gitInfo: {
		branch?: string
		remoteUrl?: string
		lastCommit?: string
		isDirty?: boolean
	}
	projectInfo: {
		language?: string
		framework?: string
		packageManager?: string
		dependencies?: string[]
	}
	permissions: {
		read: boolean
		write: boolean
		execute: boolean
		admin: boolean
	}
	lastAccessedAt?: string
	createdAt: string
	updatedAt: string
}

interface RepositoryState {
	repositories: Repository[]
	currentRepository: Repository | null
	isLoading: boolean
	error: string | null
}

interface RepositoryActions {
	fetchRepositories: () => Promise<void>
	fetchRepository: (id: string) => Promise<void>
	createRepository: (data: { name: string; path: string; description?: string }) => Promise<Repository>
	updateRepository: (id: string, data: Partial<Repository>) => Promise<void>
	deleteRepository: (id: string) => Promise<void>
	setCurrentRepository: (repository: Repository | null) => void
	clearError: () => void
}

export const useRepositoryStore = create<RepositoryState & RepositoryActions>((set, get) => ({
	// State
	repositories: [],
	currentRepository: null,
	isLoading: false,
	error: null,

	// Actions
	fetchRepositories: async () => {
		set({ isLoading: true, error: null })

		try {
			const response = await repositoryService.getRepositories()
			set({
				repositories: response.repositories,
				isLoading: false,
			})
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to fetch repositories",
				isLoading: false,
			})
		}
	},

	fetchRepository: async (id: string) => {
		set({ isLoading: true, error: null })

		try {
			const response = await repositoryService.getRepository(id)
			set({
				currentRepository: response.repository,
				isLoading: false,
			})

			// Update repository in the list if it exists
			const repositories = get().repositories
			const index = repositories.findIndex((repo) => repo.id === id)
			if (index !== -1) {
				const updatedRepositories = [...repositories]
				updatedRepositories[index] = response.repository
				set({ repositories: updatedRepositories })
			}
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to fetch repository",
				isLoading: false,
			})
		}
	},

	createRepository: async (data) => {
		set({ isLoading: true, error: null })

		try {
			const response = await repositoryService.createRepository(data)
			const newRepository = response.repository

			set((state) => ({
				repositories: [newRepository, ...state.repositories],
				isLoading: false,
			}))

			return newRepository
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to create repository",
				isLoading: false,
			})
			throw error
		}
	},

	updateRepository: async (id: string, data: Partial<Repository>) => {
		set({ isLoading: true, error: null })

		try {
			const response = await repositoryService.updateRepository(id, data)
			const updatedRepository = response.repository

			set((state) => ({
				repositories: state.repositories.map((repo) => (repo.id === id ? updatedRepository : repo)),
				currentRepository: state.currentRepository?.id === id ? updatedRepository : state.currentRepository,
				isLoading: false,
			}))
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to update repository",
				isLoading: false,
			})
			throw error
		}
	},

	deleteRepository: async (id: string) => {
		set({ isLoading: true, error: null })

		try {
			await repositoryService.deleteRepository(id)

			set((state) => ({
				repositories: state.repositories.filter((repo) => repo.id !== id),
				currentRepository: state.currentRepository?.id === id ? null : state.currentRepository,
				isLoading: false,
			}))
		} catch (error) {
			set({
				error: error instanceof Error ? error.message : "Failed to delete repository",
				isLoading: false,
			})
			throw error
		}
	},

	setCurrentRepository: (repository: Repository | null) => {
		set({ currentRepository: repository })
	},

	clearError: () => {
		set({ error: null })
	},
}))
