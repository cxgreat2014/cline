import React from "react"
import { useParams } from "react-router-dom"

const RepositoryPage: React.FC = () => {
	const { id } = useParams<{ id: string }>()

	return (
		<div className="space-y-6">
			<div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Repository Details</h1>
				<p className="text-gray-600 dark:text-gray-400">Repository ID: {id}</p>
				<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
					This page will show repository details, file browser, and task management.
				</p>
			</div>
		</div>
	)
}

export default RepositoryPage
