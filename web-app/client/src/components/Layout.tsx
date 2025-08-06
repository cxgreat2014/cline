import React, { useState } from "react"
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom"
import { Home, FolderOpen, Settings, LogOut, Menu, X, User, Bell, Search } from "lucide-react"
import { useAuthStore } from "@store/authStore"
import { useSocketStore } from "@store/socketStore"

const Layout: React.FC = () => {
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const location = useLocation()
	const navigate = useNavigate()
	const { user, logout } = useAuthStore()
	const { isConnected } = useSocketStore()

	const navigation = [
		{ name: "Dashboard", href: "/dashboard", icon: Home },
		{ name: "Repositories", href: "/repositories", icon: FolderOpen },
		{ name: "Settings", href: "/settings", icon: Settings },
	]

	const handleLogout = () => {
		logout()
		navigate("/login")
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
			{/* Mobile sidebar */}
			<div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? "block" : "hidden"}`}>
				<div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
				<div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white dark:bg-gray-800 shadow-xl">
					<div className="flex h-16 items-center justify-between px-4">
						<h1 className="text-xl font-bold text-gray-900 dark:text-white">Cline Web</h1>
						<button
							onClick={() => setSidebarOpen(false)}
							className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
							<X className="h-6 w-6" />
						</button>
					</div>
					<nav className="flex-1 px-4 py-4">
						<SidebarNavigation navigation={navigation} currentPath={location.pathname} />
					</nav>
				</div>
			</div>

			{/* Desktop sidebar */}
			<div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
				<div className="flex flex-col flex-grow bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
					<div className="flex h-16 items-center px-4">
						<h1 className="text-xl font-bold text-gray-900 dark:text-white">Cline Web</h1>
						<div className={`ml-2 h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`} />
					</div>
					<nav className="flex-1 px-4 py-4">
						<SidebarNavigation navigation={navigation} currentPath={location.pathname} />
					</nav>
					<div className="border-t border-gray-200 dark:border-gray-700 p-4">
						<UserMenu user={user} onLogout={handleLogout} />
					</div>
				</div>
			</div>

			{/* Main content */}
			<div className="lg:pl-64">
				{/* Top bar */}
				<div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
					<button
						type="button"
						className="-m-2.5 p-2.5 text-gray-700 dark:text-gray-300 lg:hidden"
						onClick={() => setSidebarOpen(true)}>
						<Menu className="h-6 w-6" />
					</button>

					{/* Search */}
					<div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
						<div className="relative flex flex-1 items-center">
							<Search className="pointer-events-none absolute left-3 h-5 w-5 text-gray-400" />
							<input
								className="block w-full rounded-md border-0 bg-gray-50 dark:bg-gray-700 py-1.5 pl-10 pr-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-600 sm:text-sm sm:leading-6"
								placeholder="Search repositories, tasks..."
								type="search"
							/>
						</div>
					</div>

					{/* Right side */}
					<div className="flex items-center gap-x-4 lg:gap-x-6">
						<button type="button" className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
							<Bell className="h-6 w-6" />
						</button>

						<div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-gray-700" />

						<div className="lg:hidden">
							<UserMenu user={user} onLogout={handleLogout} />
						</div>
					</div>
				</div>

				{/* Page content */}
				<main className="py-6">
					<div className="px-4 sm:px-6 lg:px-8">
						<Outlet />
					</div>
				</main>
			</div>
		</div>
	)
}

interface SidebarNavigationProps {
	navigation: Array<{
		name: string
		href: string
		icon: React.ComponentType<{ className?: string }>
	}>
	currentPath: string
}

const SidebarNavigation: React.FC<SidebarNavigationProps> = ({ navigation, currentPath }) => {
	return (
		<ul className="space-y-1">
			{navigation.map((item) => {
				const isActive = currentPath === item.href || currentPath.startsWith(item.href + "/")
				return (
					<li key={item.name}>
						<Link
							to={item.href}
							className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
								isActive
									? "bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
									: "text-gray-700 dark:text-gray-300 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700"
							}`}>
							<item.icon className="h-6 w-6 shrink-0" />
							{item.name}
						</Link>
					</li>
				)
			})}
		</ul>
	)
}

interface UserMenuProps {
	user: any
	onLogout: () => void
}

const UserMenu: React.FC<UserMenuProps> = ({ user, onLogout }) => {
	return (
		<div className="flex items-center gap-x-3">
			<div className="flex-shrink-0">
				<div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
					<User className="h-5 w-5 text-white" />
				</div>
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.username}</p>
				<p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
			</div>
			<button
				onClick={onLogout}
				className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
				title="Logout">
				<LogOut className="h-5 w-5" />
			</button>
		</div>
	)
}

export default Layout
