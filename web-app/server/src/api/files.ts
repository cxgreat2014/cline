import { Router } from "express"

const router = Router()

// Placeholder routes for demo
router.get("/", (req, res) => {
	res.json({
		success: true,
		data: {
			files: [],
		},
	})
})

router.get("/*", (req, res) => {
	res.json({
		success: true,
		data: {
			content: "// Demo file content",
		},
	})
})

export default router
