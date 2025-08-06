import { api } from "./api"
import type { Repository } from "@store/repositoryStore"

export interface RepositoriesResponse {
	repositories: Repository[]
}

export interface RepositoryResponse {
	repository: Repository
}

export interface CreateRepositoryRequest {
	name: string
	path: string
	description?: string
}

export interface UpdateRepositoryRequest {
	name?: string
	description?: string
	permissions?: {
		read?: boolean
		write?: boolean
		execute?: boolean
		admin?: boolean
	}
}

export interface RepositoryStatusResponse {
	status: string
	gitInfo?: any
	accessible: boolean
	error?: string
}

class RepositoryService {
	async getRepositories(): Promise<RepositoriesResponse> {
		const response = await api.get("/repositories")
		return response.data.data
	}

	async getRepository(id: string): Promise<RepositoryResponse> {
		const response = await api.get(`/repositories/${id}`)
		return response.data.data
	}

	async createRepository(data: CreateRepositoryRequest): Promise<RepositoryResponse> {
		const response = await api.post("/repositories", data)
		return response.data.data
	}

	async updateRepository(id: string, data: UpdateRepositoryRequest): Promise<RepositoryResponse> {
		const response = await api.put(`/repositories/${id}`, data)
		return response.data.data
	}

	async deleteRepository(id: string): Promise<void> {
		await api.delete(`/repositories/${id}`)
	}

	async getRepositoryStatus(id: string): Promise<RepositoryStatusResponse> {
		const response = await api.get(`/repositories/${id}/status`)
		return response.data.data
	}
}

export const repositoryService = new RepositoryService()
