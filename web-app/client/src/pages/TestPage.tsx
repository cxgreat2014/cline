import React from "react"

const TestPage: React.FC = () => {
	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
			<div className="max-w-md w-full">
				<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6 text-center">Tailwind CSS Test</h1>

					<div className="space-y-4">
						<div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg">
							<p className="text-blue-800 dark:text-blue-200">This is a blue background test</p>
						</div>

						<div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
							<p className="text-green-800 dark:text-green-200">This is a green background test</p>
						</div>

						<div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg">
							<p className="text-red-800 dark:text-red-200">This is a red background test</p>
						</div>

						<button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200">
							Test Button
						</button>

						<div className="grid grid-cols-3 gap-2">
							<div className="h-16 bg-purple-500 rounded"></div>
							<div className="h-16 bg-yellow-500 rounded"></div>
							<div className="h-16 bg-pink-500 rounded"></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default TestPage
