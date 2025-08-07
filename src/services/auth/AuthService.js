import { clineEnvConfig } from "@/config"
import { getRequestRegistry } from "@/core/controller/grpc-handler"
import { featureFlagsService, telemetryService } from "@services/posthog/PostHogClientProvider"
import { AuthState, UserInfo } from "@shared/proto/cline/account"
import { String } from "@shared/proto/cline/common"
import { FirebaseAuthProvider } from "./providers/FirebaseAuthProvider"
import { openExternal } from "@/utils/env"
import { FEATURE_FLAGS } from "@/shared/services/feature-flags/feature-flags"
import { HostProvider } from "@/hosts/host-provider"
const DefaultClineAccountURI = `${clineEnvConfig.appBaseUrl}/auth`
let authProviders = []
const availableAuthProviders = {
	firebase: FirebaseAuthProvider,
	// Add other providers here as needed
}
// TODO: Add logic to handle multiple webviews getting auth updates.
export class AuthService {
	static instance = null
	_config
	_authenticated = false
	_clineAuthInfo = null
	_provider = null
	_activeAuthStatusUpdateSubscriptions = new Set()
	_controller
	/**
	 * Creates an instance of AuthService.
	 * @param config - Configuration for the service, including the URI for authentication.
	 * @param authProvider - Optional authentication provider to use.
	 * @param controller - Optional reference to the Controller instance.
	 */
	constructor(controller, config, authProvider) {
		const providerName = authProvider || "firebase"
		this._config = Object.assign({ URI: DefaultClineAccountURI }, config)
		// Fetch AuthProviders
		// TODO:  Deliver this config from the backend securely
		// ex.  https://app.cline.bot/api/v1/auth/providers
		const authProvidersConfigs = [
			{
				name: "firebase",
				config: clineEnvConfig.firebase,
			},
		]
		// Merge authProviders with availableAuthProviders
		authProviders = authProvidersConfigs.map((provider) => {
			const providerName = provider.name
			const ProviderClass = availableAuthProviders[providerName]
			if (!ProviderClass) {
				throw new Error(`Auth provider "${providerName}" is not available`)
			}
			return {
				name: providerName,
				config: provider.config,
				provider: new ProviderClass(provider.config),
			}
		})
		this._setProvider(authProviders.find((authProvider) => authProvider.name === providerName).name)
		this._controller = controller
	}
	/**
	 * Gets the singleton instance of AuthService.
	 * @param config - Configuration for the service, including the URI for authentication.
	 * @param authProvider - Optional authentication provider to use.
	 * @param controller - Optional reference to the Controller instance.
	 * @returns The singleton instance of AuthService.
	 */
	static getInstance(controller, config, authProvider) {
		if (!AuthService.instance) {
			if (!controller) {
				console.warn("Extension context was not provided to AuthService.getInstance, using default context")
				controller = {}
			}
			if (process.env.E2E_TEST) {
				// Use require instead of import to avoid circular dependency issues
				// eslint-disable-next-line @typescript-eslint/no-var-requires
				const { AuthServiceMock } = require("./AuthServiceMock")
				AuthService.instance = AuthServiceMock.getInstance(controller, config || {}, authProvider)
			} else {
				AuthService.instance = new AuthService(controller, config || {}, authProvider)
			}
		}
		if (controller !== undefined && AuthService.instance) {
			AuthService.instance.controller = controller
		}
		return AuthService.instance
	}
	set controller(controller) {
		this._controller = controller
	}
	get authProvider() {
		return this._provider
	}
	set authProvider(providerName) {
		this._setProvider(providerName)
	}
	async getAuthToken() {
		if (!this._clineAuthInfo) {
			return null
		}
		const idToken = this._clineAuthInfo.idToken
		const shouldRefreshIdToken = await this._provider?.provider.shouldRefreshIdToken(idToken)
		if (shouldRefreshIdToken) {
			// Retrieves the stored id token and refreshes it, then updates this._clineAuthInfo
			await this.restoreRefreshTokenAndRetrieveAuthInfo()
			if (!this._clineAuthInfo) {
				return null
			}
		}
		return this._clineAuthInfo.idToken
	}
	_setProvider(providerName) {
		const providerConfig = authProviders.find((provider) => provider.name === providerName)
		if (!providerConfig) {
			throw new Error(`Auth provider "${providerName}" not found`)
		}
		this._provider = providerConfig
	}
	getInfo() {
		// TODO: this logic should be cleaner, but this will determine the authentication state for the webview -- if a user object is returned then the webview assumes authenticated, otherwise it assumes logged out (we previously returned a UserInfo object with empty fields, and this represented a broken logged in state)
		let user = null
		if (this._clineAuthInfo && this._authenticated) {
			const userInfo = this._clineAuthInfo.userInfo
			this._clineAuthInfo.userInfo.appBaseUrl = clineEnvConfig?.appBaseUrl
			user = UserInfo.create({
				// TODO: create proto for new user info type
				uid: userInfo?.id,
				displayName: userInfo?.displayName,
				email: userInfo?.email,
				photoUrl: undefined,
				appBaseUrl: userInfo?.appBaseUrl,
			})
		}
		return AuthState.create({
			user,
		})
	}
	async createAuthRequest() {
		if (this._authenticated) {
			this.sendAuthStatusUpdate()
			return String.create({ value: "Already authenticated" })
		}
		if (!this._config.URI) {
			throw new Error("Authentication URI is not configured")
		}
		const callbackHost = await HostProvider.get().getCallbackUri()
		const callbackUrl = `${callbackHost}/auth`
		// Use URL object for more graceful query construction
		const authUrl = new URL(this._config.URI)
		authUrl.searchParams.set("callback_url", callbackUrl)
		const authUrlString = authUrl.toString()
		await openExternal(authUrlString)
		return String.create({ value: authUrlString })
	}
	async handleDeauth() {
		if (!this._provider) {
			throw new Error("Auth provider is not set")
		}
		try {
			this._clineAuthInfo = null
			this._authenticated = false
			this.sendAuthStatusUpdate()
		} catch (error) {
			console.error("Error signing out:", error)
			throw error
		}
	}
	async handleAuthCallback(token, provider) {
		if (!this._provider) {
			throw new Error("Auth provider is not set")
		}
		try {
			this._clineAuthInfo = await this._provider.provider.signIn(this._controller, token, provider)
			this._authenticated = true
			await this.sendAuthStatusUpdate()
		} catch (error) {
			console.error("Error signing in with custom token:", error)
			throw error
		}
	}
	/**
	 * Clear the authentication token from the extension's storage.
	 * This is typically called when the user logs out.
	 */
	async clearAuthToken() {
		this._controller.cacheService.setSecret("clineAccountId", undefined)
	}
	/**
	 * Restores the authentication token from the extension's storage.
	 * This is typically called when the extension is activated.
	 */
	async restoreRefreshTokenAndRetrieveAuthInfo() {
		if (!this._provider || !this._provider.provider) {
			throw new Error("Auth provider is not set")
		}
		try {
			this._clineAuthInfo = await this._provider.provider.retrieveClineAuthInfo(this._controller)
			if (this._clineAuthInfo) {
				this._authenticated = true
				await this.sendAuthStatusUpdate()
			} else {
				console.warn("No user found after restoring auth token")
				this._authenticated = false
				this._clineAuthInfo = null
			}
		} catch (error) {
			console.error("Error restoring auth token:", error)
			this._authenticated = false
			this._clineAuthInfo = null
			return
		}
	}
	/**
	 * Subscribe to authStatusUpdate events
	 * @param controller The controller instance
	 * @param request The empty request
	 * @param responseStream The streaming response handler
	 * @param requestId The ID of the request (passed by the gRPC handler)
	 */
	async subscribeToAuthStatusUpdate(controller, _request, responseStream, requestId) {
		console.log("Subscribing to authStatusUpdate")
		// Add this subscription to the active subscriptions
		this._activeAuthStatusUpdateSubscriptions.add([controller, responseStream])
		// Register cleanup when the connection is closed
		const cleanup = () => {
			this._activeAuthStatusUpdateSubscriptions.delete([controller, responseStream])
		}
		// Register the cleanup function with the request registry if we have a requestId
		if (requestId) {
			getRequestRegistry().registerRequest(requestId, cleanup, { type: "authStatusUpdate_subscription" }, responseStream)
		}
		// Send the current authentication status immediately
		try {
			await this.sendAuthStatusUpdate()
		} catch (error) {
			console.error("Error sending initial auth status:", error)
			// Remove the subscription if there was an error
			this._activeAuthStatusUpdateSubscriptions.delete([controller, responseStream])
		}
	}
	/**
	 * Send an authStatusUpdate event to all active subscribers
	 */
	async sendAuthStatusUpdate() {
		// Send the event to all active subscribers
		const promises = Array.from(this._activeAuthStatusUpdateSubscriptions).map(async ([controller, responseStream]) => {
			try {
				const authInfo = this.getInfo()
				await responseStream(authInfo, false)
				// Identify the user in telemetry if available
				// Fetch the feature flags for the user
				if (this._clineAuthInfo?.userInfo?.id) {
					telemetryService.identifyAccount(this._clineAuthInfo.userInfo)
					for (const flag of Object.values(FEATURE_FLAGS)) {
						await featureFlagsService?.isFeatureFlagEnabled(flag)
					}
				}
				// Update the state in the webview
				if (controller) {
					await controller.postStateToWebview()
				}
			} catch (error) {
				console.error("Error sending authStatusUpdate event:", error)
				// Remove the subscription if there was an error
				this._activeAuthStatusUpdateSubscriptions.delete([controller, responseStream])
			}
		})
		await Promise.all(promises)
	}
}
//# sourceMappingURL=AuthService.js.map
