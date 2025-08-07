import { Router } from "express"

const router = Router()

// Placeholder routes for demo
router.get("/", (req, res) => {
	res.json({
		success: true,
		data: {
			tasks: [],
		},
	})
})

router.post("/", (req, res) => {
	res.json({
		success: true,
		data: {
			task: {
				id: "demo-task-1",
				title: "Demo Task",
				status: "pending",
			},
		},
	})
})

export default router
