import { Router } from "express"

const router = Router()

// Placeholder routes for demo
router.get("/", (req, res) => {
	res.json({
		success: true,
		data: {
			terminals: [],
		},
	})
})

router.post("/", (req, res) => {
	res.json({
		success: true,
		data: {
			terminal: {
				id: "demo-terminal-1",
				name: "Demo Terminal",
				status: "active",
			},
		},
	})
})

export default router
