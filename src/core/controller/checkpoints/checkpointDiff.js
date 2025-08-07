import { Empty } from "@shared/proto/cline/common"
export async function checkpointDiff(controller, request) {
	if (request.value) {
		await controller.task?.presentMultifileDiff(request.value, false)
	}
	return Empty
}
//# sourceMappingURL=checkpointDiff.js.map
