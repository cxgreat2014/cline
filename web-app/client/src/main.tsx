import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import "./index.css"

// Error boundary for development
if (import.meta.env.DEV) {
	// Enable React DevTools
	if (typeof window !== "undefined") {
		window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = window.__REACT_DEVTOOLS_GLOBAL_HOOK__ || {}
	}
}

// Global error handler
window.addEventListener("error", (event) => {
	console.error("Global error:", event.error)
})

window.addEventListener("unhandledrejection", (event) => {
	console.error("Unhandled promise rejection:", event.reason)
})

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
)
