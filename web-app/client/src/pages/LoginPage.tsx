import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff, LogIn } from "lucide-react"
import toast from "react-hot-toast"
import { useAuthStore } from "@store/authStore"

const LoginPage: React.FC = () => {
	const [formData, setFormData] = useState({
		email: "",
		password: "",
	})
	const [showPassword, setShowPassword] = useState(false)
	const [isRegistering, setIsRegistering] = useState(false)
	const [registerData, setRegisterData] = useState({
		username: "",
		email: "",
		password: "",
		confirmPassword: "",
	})

	const { login, register, isLoading, error, clearError } = useAuthStore()
	const navigate = useNavigate()

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		clearError()

		if (!formData.email || !formData.password) {
			toast.error("Please fill in all fields")
			return
		}

		try {
			await login(formData.email, formData.password)
			toast.success("Welcome back!")
			navigate("/dashboard")
		} catch (error) {
			// Error is handled by the store and displayed via toast in the API interceptor
		}
	}

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault()
		clearError()

		if (!registerData.username || !registerData.email || !registerData.password) {
			toast.error("Please fill in all fields")
			return
		}

		if (registerData.password !== registerData.confirmPassword) {
			toast.error("Passwords do not match")
			return
		}

		if (registerData.password.length < 8) {
			toast.error("Password must be at least 8 characters long")
			return
		}

		try {
			await register(registerData.username, registerData.email, registerData.password)
			toast.success("Account created successfully!")
			navigate("/dashboard")
		} catch (error) {
			// Error is handled by the store and displayed via toast in the API interceptor
		}
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target
		if (isRegistering) {
			setRegisterData((prev) => ({ ...prev, [name]: value }))
		} else {
			setFormData((prev) => ({ ...prev, [name]: value }))
		}
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-md w-full space-y-8">
				<div>
					<div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-600">
						<LogIn className="h-8 w-8 text-white" />
					</div>
					<h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
						{isRegistering ? "Create your account" : "Sign in to Cline Web"}
					</h2>
					<p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
						{isRegistering ? "Already have an account? " : "Don't have an account? "}
						<button
							onClick={() => {
								setIsRegistering(!isRegistering)
								clearError()
							}}
							className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
							{isRegistering ? "Sign in" : "Sign up"}
						</button>
					</p>
				</div>

				<form className="mt-8 space-y-6" onSubmit={isRegistering ? handleRegister : handleLogin}>
					<div className="space-y-4">
						{isRegistering && (
							<div>
								<label htmlFor="username" className="sr-only">
									Username
								</label>
								<input
									id="username"
									name="username"
									type="text"
									autoComplete="username"
									required
									className="relative block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
									placeholder="Username"
									value={registerData.username}
									onChange={handleInputChange}
								/>
							</div>
						)}

						<div>
							<label htmlFor="email" className="sr-only">
								Email address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								className="relative block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
								placeholder="Email address"
								value={isRegistering ? registerData.email : formData.email}
								onChange={handleInputChange}
							/>
						</div>

						<div className="relative">
							<label htmlFor="password" className="sr-only">
								Password
							</label>
							<input
								id="password"
								name="password"
								type={showPassword ? "text" : "password"}
								autoComplete={isRegistering ? "new-password" : "current-password"}
								required
								className="relative block w-full rounded-md border-0 py-1.5 px-3 pr-10 text-gray-900 dark:text-white bg-white dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
								placeholder="Password"
								value={isRegistering ? registerData.password : formData.password}
								onChange={handleInputChange}
							/>
							<button
								type="button"
								className="absolute inset-y-0 right-0 pr-3 flex items-center"
								onClick={() => setShowPassword(!showPassword)}>
								{showPassword ? (
									<EyeOff className="h-5 w-5 text-gray-400" />
								) : (
									<Eye className="h-5 w-5 text-gray-400" />
								)}
							</button>
						</div>

						{isRegistering && (
							<div>
								<label htmlFor="confirmPassword" className="sr-only">
									Confirm Password
								</label>
								<input
									id="confirmPassword"
									name="confirmPassword"
									type="password"
									autoComplete="new-password"
									required
									className="relative block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 dark:text-white bg-white dark:bg-gray-800 ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
									placeholder="Confirm password"
									value={registerData.confirmPassword}
									onChange={handleInputChange}
								/>
							</div>
						)}
					</div>

					{error && (
						<div className="rounded-md bg-red-50 dark:bg-red-900/50 p-4">
							<div className="text-sm text-red-700 dark:text-red-300">{error}</div>
						</div>
					)}

					<div>
						<button
							type="submit"
							disabled={isLoading}
							className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
							{isLoading ? (
								<div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
							) : (
								<>
									<LogIn className="h-5 w-5 mr-2" />
									{isRegistering ? "Create Account" : "Sign In"}
								</>
							)}
						</button>
					</div>
				</form>

				<div className="text-center">
					<p className="text-xs text-gray-500 dark:text-gray-400">
						By signing in, you agree to our{" "}
						<Link to="/terms" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link to="/privacy" className="text-blue-600 hover:text-blue-500 dark:text-blue-400">
							Privacy Policy
						</Link>
					</p>
				</div>
			</div>
		</div>
	)
}

export default LoginPage
