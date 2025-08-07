import { log } from "./utils"
function postMessage(message) {
	log("postMessage stub called:", JSON.stringify(message).slice(0, 200))
	return Promise.resolve(true)
}
export { postMessage }
//# sourceMappingURL=vscode-context-stubs.js.map
