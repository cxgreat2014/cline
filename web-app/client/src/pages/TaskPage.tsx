import React from "react"
import { useParams } from "react-router-dom"

const TaskPage: React.FC = () => {
	const { repositoryId, taskId } = useParams<{ repositoryId: string; taskId: string }>()

	return (
		<div className="space-y-6">
			<div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Task Details</h1>
				<p className="text-gray-600 dark:text-gray-400">Repository ID: {repositoryId}</p>
				<p className="text-gray-600 dark:text-gray-400">Task ID: {taskId}</p>
				<p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
					This page will show the task conversation, file changes, and execution status.
				</p>
			</div>
		</div>
	)
}

export default TaskPage
