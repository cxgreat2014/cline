import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios"
import toast from "react-hot-toast"

// Create axios instance
export const api: AxiosInstance = axios.create({
	baseURL: import.meta.env?.VITE_API_URL || "http://localhost:8000/api",
	timeout: 30000,
	headers: {
		"Content-Type": "application/json",
	},
})

// Request interceptor to add auth token
api.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		// Get token from localStorage
		const authData = localStorage.getItem("cline-auth")
		if (authData) {
			try {
				const { state } = JSON.parse(authData)
				if (state?.token) {
					config.headers.Authorization = `Bearer ${state.token}`
				}
			} catch (error) {
				console.warn("Failed to parse auth data:", error)
			}
		}

		return config
	},
	(error) => {
		return Promise.reject(error)
	},
)

// Response interceptor for error handling
api.interceptors.response.use(
	(response) => {
		return response
	},
	async (error: AxiosError) => {
		const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

		// Handle network errors
		if (!error.response) {
			toast.error("Network error. Please check your connection.")
			return Promise.reject(error)
		}

		const { status, data } = error.response

		// Handle different error status codes
		switch (status) {
			case 401:
				// Unauthorized - token expired or invalid
				if (!originalRequest._retry) {
					originalRequest._retry = true

					try {
						// Try to refresh token
						const authData = localStorage.getItem("cline-auth")
						if (authData) {
							const { state } = JSON.parse(authData)
							if (state?.token) {
								const refreshResponse = await api.post("/auth/refresh")
								const newToken = refreshResponse.data.data.token

								// Update token in localStorage
								const updatedAuthData = {
									...JSON.parse(authData),
									state: {
										...state,
										token: newToken,
									},
								}
								localStorage.setItem("cline-auth", JSON.stringify(updatedAuthData))

								// Retry original request with new token
								originalRequest.headers.Authorization = `Bearer ${newToken}`
								return api(originalRequest)
							}
						}
					} catch (refreshError) {
						// Refresh failed, redirect to login
						localStorage.removeItem("cline-auth")
						window.location.href = "/login"
						return Promise.reject(refreshError)
					}
				}

				// If retry failed or no token, redirect to login
				localStorage.removeItem("cline-auth")
				window.location.href = "/login"
				break

			case 403:
				// Forbidden
				toast.error("Access denied. You don't have permission to perform this action.")
				break

			case 404:
				// Not found
				toast.error("Resource not found.")
				break

			case 409:
				// Conflict
				const conflictMessage = (data as any)?.error?.message || "Resource already exists."
				toast.error(conflictMessage)
				break

			case 422:
				// Validation error
				const validationMessage = (data as any)?.error?.message || "Validation failed."
				toast.error(validationMessage)
				break

			case 429:
				// Rate limit exceeded
				toast.error("Too many requests. Please try again later.")
				break

			case 500:
				// Internal server error
				toast.error("Server error. Please try again later.")
				break

			default:
				// Generic error
				const errorMessage = (data as any)?.error?.message || "An unexpected error occurred."
				toast.error(errorMessage)
		}

		return Promise.reject(error)
	},
)

// API response types
export interface ApiResponse<T = any> {
	success: boolean
	data?: T
	error?: {
		code: string
		message: string
		details?: any
	}
}

export interface PaginatedResponse<T = any> {
	items: T[]
	total: number
	page: number
	limit: number
	totalPages: number
}

// Helper functions
export const handleApiError = (error: any): string => {
	if (error.response?.data?.error?.message) {
		return error.response.data.error.message
	}

	if (error.message) {
		return error.message
	}

	return "An unexpected error occurred"
}

export const isApiError = (error: any): error is AxiosError => {
	return error.isAxiosError === true
}

// File upload helper
export const uploadFile = async (endpoint: string, file: File, onProgress?: (progress: number) => void): Promise<any> => {
	const formData = new FormData()
	formData.append("file", file)

	const response = await api.post(endpoint, formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
		onUploadProgress: (progressEvent) => {
			if (onProgress && progressEvent.total) {
				const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
				onProgress(progress)
			}
		},
	})

	return response.data
}

// Download helper
export const downloadFile = async (url: string, filename?: string): Promise<void> => {
	const response = await api.get(url, {
		responseType: "blob",
	})

	const blob = new Blob([response.data])
	const downloadUrl = window.URL.createObjectURL(blob)

	const link = document.createElement("a")
	link.href = downloadUrl
	link.download = filename || "download"
	document.body.appendChild(link)
	link.click()
	document.body.removeChild(link)

	window.URL.revokeObjectURL(downloadUrl)
}
