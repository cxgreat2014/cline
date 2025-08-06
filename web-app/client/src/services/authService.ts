import { api } from "./api"
import type { User } from "@store/authStore"

export interface LoginResponse {
	user: User
	token: string
}

export interface RegisterResponse {
	user: User
	token: string
}

export interface ProfileUpdateResponse {
	user: User
}

export interface CurrentUserResponse {
	user: User
}

export interface RefreshTokenResponse {
	token: string
}

class AuthService {
	async login(email: string, password: string): Promise<LoginResponse> {
		const response = await api.post("/auth/login", { email, password })
		return response.data.data
	}

	async register(username: string, email: string, password: string): Promise<RegisterResponse> {
		const response = await api.post("/auth/register", { username, email, password })
		return response.data.data
	}

	async logout(): Promise<void> {
		try {
			await api.post("/auth/logout")
		} catch (error) {
			// Ignore logout errors
			console.warn("Logout API call failed:", error)
		}
	}

	async getCurrentUser(): Promise<CurrentUserResponse> {
		const response = await api.get("/auth/me")
		return response.data.data
	}

	async updateProfile(data: Partial<User>): Promise<ProfileUpdateResponse> {
		const response = await api.put("/auth/profile", data)
		return response.data.data
	}

	async changePassword(currentPassword: string, newPassword: string): Promise<void> {
		await api.put("/auth/password", { currentPassword, newPassword })
	}

	async refreshToken(): Promise<RefreshTokenResponse> {
		const response = await api.post("/auth/refresh")
		return response.data.data
	}
}

export const authService = new AuthService()
