import { create } from "zustand"
import { persist } from "zustand/middleware"
import { authService } from "@services/authService"

export interface User {
	id: string
	username: string
	email: string
	role: string
	isActive: boolean
	preferences: {
		theme?: "light" | "dark"
		language?: string
		autoApproval?: boolean
		notifications?: boolean
	}
	lastLoginAt?: string
	createdAt: string
	updatedAt: string
}

interface AuthState {
	user: User | null
	token: string | null
	isAuthenticated: boolean
	isLoading: boolean
	error: string | null
}

interface AuthActions {
	login: (email: string, password: string) => Promise<void>
	register: (username: string, email: string, password: string) => Promise<void>
	logout: () => void
	updateProfile: (data: Partial<User>) => Promise<void>
	changePassword: (currentPassword: string, newPassword: string) => Promise<void>
	refreshToken: () => Promise<void>
	clearError: () => void
	initialize: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
	persist(
		(set, get) => ({
			// State
			user: null,
			token: null,
			isAuthenticated: false,
			isLoading: false,
			error: null,

			// Actions
			login: async (email: string, password: string) => {
				set({ isLoading: true, error: null })

				try {
					const response = await authService.login(email, password)

					set({
						user: response.user,
						token: response.token,
						isAuthenticated: true,
						isLoading: false,
						error: null,
					})
				} catch (error) {
					set({
						isLoading: false,
						error: error instanceof Error ? error.message : "Login failed",
					})
					throw error
				}
			},

			register: async (username: string, email: string, password: string) => {
				set({ isLoading: true, error: null })

				try {
					const response = await authService.register(username, email, password)

					set({
						user: response.user,
						token: response.token,
						isAuthenticated: true,
						isLoading: false,
						error: null,
					})
				} catch (error) {
					set({
						isLoading: false,
						error: error instanceof Error ? error.message : "Registration failed",
					})
					throw error
				}
			},

			logout: () => {
				// Call logout API if needed
				authService.logout().catch(console.error)

				set({
					user: null,
					token: null,
					isAuthenticated: false,
					error: null,
				})
			},

			updateProfile: async (data: Partial<User>) => {
				set({ isLoading: true, error: null })

				try {
					const response = await authService.updateProfile(data)

					set({
						user: response.user,
						isLoading: false,
						error: null,
					})
				} catch (error) {
					set({
						isLoading: false,
						error: error instanceof Error ? error.message : "Profile update failed",
					})
					throw error
				}
			},

			changePassword: async (currentPassword: string, newPassword: string) => {
				set({ isLoading: true, error: null })

				try {
					await authService.changePassword(currentPassword, newPassword)

					set({
						isLoading: false,
						error: null,
					})
				} catch (error) {
					set({
						isLoading: false,
						error: error instanceof Error ? error.message : "Password change failed",
					})
					throw error
				}
			},

			refreshToken: async () => {
				const { token } = get()
				if (!token) return

				try {
					const response = await authService.refreshToken()

					set({
						token: response.token,
						error: null,
					})
				} catch (error) {
					// Token refresh failed, logout user
					get().logout()
					throw error
				}
			},

			clearError: () => {
				set({ error: null })
			},

			initialize: () => {
				const state = get()
				if (state.token && state.user) {
					set({ isAuthenticated: true })

					// Verify token is still valid
					authService
						.getCurrentUser()
						.then((response) => {
							set({ user: response.user })
						})
						.catch(() => {
							// Token is invalid, logout
							get().logout()
						})
				}
			},
		}),
		{
			name: "cline-auth",
			partialize: (state) => ({
				user: state.user,
				token: state.token,
				isAuthenticated: state.isAuthenticated,
			}),
		},
	),
)
