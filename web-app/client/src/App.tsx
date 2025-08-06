import React from "react"
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { Toaster } from "react-hot-toast"

// Pages
import LoginPage from "@pages/LoginPage"
import DashboardPage from "@pages/DashboardPage"
import RepositoryPage from "@pages/RepositoryPage"
import TaskPage from "@pages/TaskPage"
import SettingsPage from "@pages/SettingsPage"

// Components
import Layout from "@components/Layout"
import ProtectedRoute from "@components/ProtectedRoute"

// Hooks
import { useAuthStore } from "@store/authStore"
import { useSocketStore } from "@store/socketStore"

// Services
import { initializeSocket } from "@services/socketService"

function App() {
	const { isAuthenticated, user, initialize } = useAuthStore()
	const { connect } = useSocketStore()

	React.useEffect(() => {
		// Initialize auth state from localStorage
		initialize()
	}, [initialize])

	React.useEffect(() => {
		// Initialize socket connection when authenticated
		if (isAuthenticated && user) {
			const socket = initializeSocket()
			connect(socket)
		}
	}, [isAuthenticated, user, connect])

	return (
		<Router>
			<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
				<Routes>
					{/* Public routes */}
					<Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

					{/* Protected routes */}
					<Route path="/" element={<ProtectedRoute />}>
						<Route path="/" element={<Navigate to="/dashboard" replace />} />

						<Route element={<Layout />}>
							<Route path="/dashboard" element={<DashboardPage />} />
							<Route path="/repositories/:id" element={<RepositoryPage />} />
							<Route path="/repositories/:repositoryId/tasks/:taskId" element={<TaskPage />} />
							<Route path="/settings" element={<SettingsPage />} />
						</Route>
					</Route>

					{/* Catch all route */}
					<Route path="*" element={<Navigate to="/dashboard" replace />} />
				</Routes>

				{/* Global toast notifications */}
				<Toaster
					position="top-right"
					toastOptions={{
						duration: 4000,
						style: {
							background: "#363636",
							color: "#fff",
						},
						success: {
							duration: 3000,
							iconTheme: {
								primary: "#4ade80",
								secondary: "#fff",
							},
						},
						error: {
							duration: 5000,
							iconTheme: {
								primary: "#ef4444",
								secondary: "#fff",
							},
						},
					}}
				/>
			</div>
		</Router>
	)
}

export default App
