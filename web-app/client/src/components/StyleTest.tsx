import React from "react"
import { CheckCircle, AlertCircle, XCircle } from "lucide-react"

const StyleTest: React.FC = () => {
	return (
		<div className="p-8 space-y-6">
			<h2 className="text-2xl font-bold text-gray-900 dark:text-white">Tailwind CSS Style Test</h2>

			{/* Colors */}
			<div className="grid grid-cols-4 gap-4">
				<div className="h-16 bg-blue-500 rounded-lg flex items-center justify-center">
					<span className="text-white font-medium">Blue</span>
				</div>
				<div className="h-16 bg-green-500 rounded-lg flex items-center justify-center">
					<span className="text-white font-medium">Green</span>
				</div>
				<div className="h-16 bg-red-500 rounded-lg flex items-center justify-center">
					<span className="text-white font-medium">Red</span>
				</div>
				<div className="h-16 bg-purple-500 rounded-lg flex items-center justify-center">
					<span className="text-white font-medium">Purple</span>
				</div>
			</div>

			{/* Buttons */}
			<div className="flex gap-4">
				<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
					Primary Button
				</button>
				<button className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
					Secondary Button
				</button>
				<button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
					Danger Button
				</button>
			</div>

			{/* Icons */}
			<div className="flex gap-4 items-center">
				<CheckCircle className="h-6 w-6 text-green-500" />
				<AlertCircle className="h-6 w-6 text-yellow-500" />
				<XCircle className="h-6 w-6 text-red-500" />
			</div>

			{/* Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Light Card</h3>
					<p className="text-gray-600 dark:text-gray-300">This is a test card with light background.</p>
				</div>
				<div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-lg">
					<h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Gray Card</h3>
					<p className="text-gray-600 dark:text-gray-300">This is a test card with gray background.</p>
				</div>
			</div>

			{/* Form Elements */}
			<div className="space-y-4">
				<input
					type="text"
					placeholder="Test input field"
					className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
					<option>Option 1</option>
					<option>Option 2</option>
					<option>Option 3</option>
				</select>
			</div>
		</div>
	)
}

export default StyleTest
