import { URI } from "vscode-uri"
import { WebviewProvider } from "@core/webview"
export class ExternalWebviewProvider extends WebviewProvider {
	// This hostname cannot be changed without updating the external webview handler.
	RESOURCE_HOSTNAME = "internal.resources"
	constructor(context, providerType) {
		super(context, providerType)
	}
	getWebviewUri(uri) {
		if (uri.scheme !== "file") {
			return uri
		}
		return URI.from({ scheme: "https", authority: this.RESOURCE_HOSTNAME, path: uri.fsPath })
	}
	getCspSource() {
		return `'self' https://${this.RESOURCE_HOSTNAME}`
	}
	postMessageToWebview(message) {
		console.log(`postMessageToWebview: ${message}`)
		return undefined
	}
	isVisible() {
		return true
	}
	getWebview() {
		return {}
	}
	resolveWebviewView(_) {
		return Promise.resolve()
	}
}
//# sourceMappingURL=ExternalWebviewProvider.js.map
