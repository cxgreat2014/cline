/**
 * Singleton class that manages host-specific providers for dependency injection.
 *
 * This system runs on two different platforms (VSCode extension and cline-core),
 * so all the host-specific classes and properties are contained in here. The
 * rest of the codebase can use the host provider interface to access platform-specific
 * implementations in a platform-agnostic way.
 *
 * Usage:
 * - Initialize once: HostProvider.initialize(webviewCreator, diffCreator, hostBridge)
 * - Access HostBridge services: HostProvider.window.showMessage()
 * - Access Host Provider factories: HostProvider.get().createDiffViewProvider()
 */
export class HostProvider {
	static instance = null
	createWebviewProvider
	createDiffViewProvider
	hostBridge
	// Logs to a user-visible output channel.
	logToChannel
	// Returns a callback URI that will redirect to Cline.
	getCallbackUri
	// Private constructor to enforce singleton pattern
	constructor(createWebviewProvider, createDiffViewProvider, hostBridge, logToChannel, getCallbackUri) {
		this.createWebviewProvider = createWebviewProvider
		this.createDiffViewProvider = createDiffViewProvider
		this.hostBridge = hostBridge
		this.logToChannel = logToChannel
		this.getCallbackUri = getCallbackUri
	}
	static initialize(webviewProviderCreator, diffViewProviderCreator, hostBridgeProvider, logToChannel, getCallbackUri) {
		if (HostProvider.instance) {
			throw new Error("Host providers have already been initialized.")
		}
		HostProvider.instance = new HostProvider(
			webviewProviderCreator,
			diffViewProviderCreator,
			hostBridgeProvider,
			logToChannel,
			getCallbackUri,
		)
		return HostProvider.instance
	}
	/**
	 * Gets the singleton instance
	 */
	static get() {
		if (!HostProvider.instance) {
			throw new Error("HostProvider not setup. Call HostProvider.initialize() first.")
		}
		return HostProvider.instance
	}
	static isInitialized() {
		return !!HostProvider.instance
	}
	/**
	 * Resets the HostProvider instance (primarily for testing)
	 * This allows tests to reinitialize the HostProvider with different configurations
	 */
	static reset() {
		HostProvider.instance = null
	}
	// Static service accessors for more concise access for callers.
	static get watch() {
		return HostProvider.get().hostBridge.watchServiceClient
	}
	static get workspace() {
		return HostProvider.get().hostBridge.workspaceClient
	}
	static get env() {
		return HostProvider.get().hostBridge.envClient
	}
	static get window() {
		return HostProvider.get().hostBridge.windowClient
	}
	static get diff() {
		return HostProvider.get().hostBridge.diffClient
	}
}
//# sourceMappingURL=host-provider.js.map
