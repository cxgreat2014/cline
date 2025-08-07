import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, FolderOpen, GitBranch, Clock, Activity, AlertCircle, CheckCircle, XCircle, Search, Filter } from "lucide-react"
import toast from "react-hot-toast"
import { useRepositoryStore, Repository } from "@store/repositoryStore"
import { useAuthStore } from "@store/authStore"
import { formatDistanceToNow } from "date-fns"

const DashboardPage: React.FC = () => {
	const [searchTerm, setSearchTerm] = useState("")
	const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "error">("all")
	const [showCreateModal, setShowCreateModal] = useState(false)

	const { repositories, isLoading, error, fetchRepositories, clearError } = useRepositoryStore()
	const { user } = useAuthStore()
	// const navigate = useNavigate() // Commented out to avoid unused variable warning

	useEffect(() => {
		fetchRepositories()
	}, [fetchRepositories])

	useEffect(() => {
		if (error) {
			toast.error(error)
			clearError()
		}
	}, [error, clearError])

	const filteredRepositories = repositories.filter((repo) => {
		const matchesSearch =
			repo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			repo.description.toLowerCase().includes(searchTerm.toLowerCase())
		const matchesStatus = statusFilter === "all" || repo.status === statusFilter
		return matchesSearch && matchesStatus
	})

	// Moved these functions to RepositoryCard component to avoid unused variable warnings

	if (isLoading && repositories.length === 0) {
		return (
			<div className="flex items-center justify-center h-64">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-4 text-gray-600 dark:text-gray-400">Loading repositories...</p>
				</div>
			</div>
		)
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {user?.username}!</h1>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Manage your repositories and start coding with AI assistance
					</p>
				</div>
				<button
					onClick={() => setShowCreateModal(true)}
					className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
					<Plus className="h-4 w-4 mr-2" />
					Add Repository
				</button>
			</div>

			{/* Stats */}
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
				<div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<FolderOpen className="h-6 w-6 text-gray-400" />
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
										Total Repositories
									</dt>
									<dd className="text-lg font-medium text-gray-900 dark:text-white">{repositories.length}</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<CheckCircle className="h-6 w-6 text-green-400" />
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active</dt>
									<dd className="text-lg font-medium text-gray-900 dark:text-white">
										{repositories.filter((r) => r.status === "active").length}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<GitBranch className="h-6 w-6 text-blue-400" />
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
										Git Repositories
									</dt>
									<dd className="text-lg font-medium text-gray-900 dark:text-white">
										{repositories.filter((r) => r.gitInfo?.branch).length}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
					<div className="p-5">
						<div className="flex items-center">
							<div className="flex-shrink-0">
								<Activity className="h-6 w-6 text-purple-400" />
							</div>
							<div className="ml-5 w-0 flex-1">
								<dl>
									<dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
										Recently Active
									</dt>
									<dd className="text-lg font-medium text-gray-900 dark:text-white">
										{
											repositories.filter(
												(r) =>
													r.lastAccessedAt &&
													new Date(r.lastAccessedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
											).length
										}
									</dd>
								</dl>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
					<input
						type="text"
						placeholder="Search repositories..."
						className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
					/>
				</div>
				<div className="flex items-center gap-2">
					<Filter className="h-4 w-4 text-gray-400" />
					<select
						className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
						value={statusFilter}
						onChange={(e) => setStatusFilter(e.target.value as any)}>
						<option value="all">All Status</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
						<option value="error">Error</option>
					</select>
				</div>
			</div>

			{/* Repository List */}
			{filteredRepositories.length === 0 ? (
				<div className="text-center py-12">
					<FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
					<h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
						{repositories.length === 0 ? "No repositories" : "No matching repositories"}
					</h3>
					<p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{repositories.length === 0
							? "Get started by adding your first repository."
							: "Try adjusting your search or filter criteria."}
					</p>
					{repositories.length === 0 && (
						<div className="mt-6">
							<button
								onClick={() => setShowCreateModal(true)}
								className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
								<Plus className="h-4 w-4 mr-2" />
								Add Repository
							</button>
						</div>
					)}
				</div>
			) : (
				<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{filteredRepositories.map((repository) => (
						<RepositoryCard key={repository.id} repository={repository} />
					))}
				</div>
			)}

			{/* Create Repository Modal */}
			{showCreateModal && (
				<CreateRepositoryModal
					onClose={() => setShowCreateModal(false)}
					onSuccess={() => {
						setShowCreateModal(false)
						fetchRepositories()
					}}
				/>
			)}
		</div>
	)
}

interface RepositoryCardProps {
	repository: Repository
}

const RepositoryCard: React.FC<RepositoryCardProps> = ({ repository }) => {
	const navigate = useNavigate()

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "active":
				return <CheckCircle className="h-4 w-4 text-green-500" />
			case "inactive":
				return <Clock className="h-4 w-4 text-yellow-500" />
			case "error":
				return <XCircle className="h-4 w-4 text-red-500" />
			default:
				return <AlertCircle className="h-4 w-4 text-gray-500" />
		}
	}

	const getLanguageColor = (language?: string) => {
		const colors: Record<string, string> = {
			javascript: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
			typescript: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
			python: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
			rust: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
			go: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
		}
		return colors[language || ""] || "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
	}

	return (
		<div
			className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
			onClick={() => navigate(`/repositories/${repository.id}`)}>
			<div className="p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center">
						<FolderOpen className="h-6 w-6 text-gray-400" />
						<h3 className="ml-2 text-lg font-medium text-gray-900 dark:text-white truncate">{repository.name}</h3>
					</div>
					{getStatusIcon(repository.status)}
				</div>

				{repository.description && (
					<p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{repository.description}</p>
				)}

				<div className="mt-4 flex items-center justify-between">
					<div className="flex items-center space-x-2">
						{repository.projectInfo?.language && (
							<span
								className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLanguageColor(repository.projectInfo.language)}`}>
								{repository.projectInfo.language}
							</span>
						)}
						{repository.gitInfo?.branch && (
							<div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
								<GitBranch className="h-3 w-3 mr-1" />
								{repository.gitInfo.branch}
							</div>
						)}
					</div>

					{repository.lastAccessedAt && (
						<span className="text-xs text-gray-500 dark:text-gray-400">
							{formatDistanceToNow(new Date(repository.lastAccessedAt), { addSuffix: true })}
						</span>
					)}
				</div>
			</div>
		</div>
	)
}

// Placeholder for CreateRepositoryModal component
const CreateRepositoryModal: React.FC<{
	onClose: () => void
	onSuccess: () => void
}> = ({ onClose, onSuccess }) => {
	// This would be implemented as a proper modal component
	return (
		<div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
			<div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
				<h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Add Repository</h3>
				<p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
					This modal would contain a form to add a new repository.
				</p>
				<div className="flex justify-end space-x-3">
					<button
						onClick={onClose}
						className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600">
						Cancel
					</button>
					<button
						onClick={onSuccess}
						className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
						Add Repository
					</button>
				</div>
			</div>
		</div>
	)
}

export default DashboardPage
