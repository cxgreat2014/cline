import React from "react"

const SettingsPage: React.FC = () => {
	return (
		<div className="space-y-6">
			<div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
				<h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Settings</h1>
				<p className="text-sm text-gray-500 dark:text-gray-400">
					This page will contain user preferences, API configurations, and system settings.
				</p>
			</div>
		</div>
	)
}

export default SettingsPage
