import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@components": path.resolve(__dirname, "./src/components"),
			"@pages": path.resolve(__dirname, "./src/pages"),
			"@hooks": path.resolve(__dirname, "./src/hooks"),
			"@services": path.resolve(__dirname, "./src/services"),
			"@store": path.resolve(__dirname, "./src/store"),
			"@utils": path.resolve(__dirname, "./src/utils"),
			"@types": path.resolve(__dirname, "./src/types"),
			"@shared": path.resolve(__dirname, "../shared"),
		},
	},
	server: {
		port: 3000,
		proxy: {
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
			},
			"/socket.io": {
				target: "http://localhost:8000",
				changeOrigin: true,
				ws: true,
			},
		},
	},
	build: {
		outDir: "dist",
		sourcemap: true,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ["react", "react-dom", "react-router-dom"],
					utils: ["socket.io-client", "axios", "zustand"],
				},
			},
		},
	},
	optimizeDeps: {
		include: ["react", "react-dom", "react-router-dom", "socket.io-client", "axios", "zustand"],
	},
})
