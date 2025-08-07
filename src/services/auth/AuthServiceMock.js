import { String } from "@shared/proto/cline/common"
import { clineEnvConfig } from "@/config"
import { WebviewProvider } from "@/core/webview"
import { AuthService } from "./AuthService"
export class AuthServiceMock extends AuthService {
	constructor(controller, config, authProvider) {
		super(controller, config, authProvider)
		if (process?.env?.CLINE_ENVIRONMENT !== "local") {
			throw new Error("AuthServiceMock should only be used in local environment for testing purposes.")
		}
		this._config = Object.assign({ URI: clineEnvConfig.apiBaseUrl }, config)
		const providerName = "firebase"
		this._setProvider(providerName)
		this._controller = controller
	}
	/**
	 * Gets the singleton instance of AuthServiceMock.
	 */
	static getInstance(controller, config, authProvider) {
		if (!AuthServiceMock.instance) {
			if (!controller) {
				console.error("Extension controller was not provided to AuthServiceMock.getInstance")
				throw new Error("Extension controller was not provided to AuthServiceMock.getInstance")
			}
			AuthServiceMock.instance = new AuthServiceMock(controller, config || {}, authProvider)
		}
		if (controller !== undefined) {
			AuthServiceMock.instance.controller = controller
		}
		return AuthServiceMock.instance
	}
	async getAuthToken() {
		if (!this._clineAuthInfo) {
			return null
		}
		return this._clineAuthInfo.idToken
	}
	async createAuthRequest() {
		// Use URL object for more graceful query construction
		const authUrl = new URL(clineEnvConfig.apiBaseUrl)
		const authUrlString = authUrl.toString()
		// Call the parent implementation
		if (this._authenticated && this._clineAuthInfo) {
			console.log("Already authenticated with mock server")
			return String.create({ value: authUrlString })
		}
		try {
			// Fetch user data from mock server
			const meUri = new URL("/api/v1/users/me", clineEnvConfig.apiBaseUrl)
			const tokenType = "personal"
			const testToken = `test-${tokenType}-token`
			const response = await fetch(meUri, {
				method: "GET",
				headers: {
					Authorization: `Bearer ${testToken}`,
					"Content-Type": "application/json",
				},
			})
			if (!response.ok) {
				throw new Error(`Mock server authentication failed: ${response.status} ${response.statusText}`)
			}
			const responseData = await response.json()
			if (!responseData.success || !responseData.data) {
				throw new Error("Invalid response from mock server")
			}
			const userData = responseData.data
			// Convert UserResponse to ClineAuthInfo format
			this._clineAuthInfo = {
				idToken: testToken,
				userInfo: {
					id: userData.id,
					email: userData.email,
					displayName: userData.displayName,
					createdAt: userData.createdAt,
					organizations: userData.organizations.map((org) => ({
						active: org.active,
						memberId: org.memberId,
						name: org.name,
						organizationId: org.organizationId,
						roles: org.roles,
					})),
				},
			}
			console.log(`Successfully authenticated with mock server as ${userData.displayName} (${userData.email})`)
			const visibleWebview = WebviewProvider.getVisibleInstance()
			await visibleWebview?.controller.handleAuthCallback(testToken, "mock")
		} catch (error) {
			console.error("Error signing in with mock server:", error)
			this._authenticated = false
			this._clineAuthInfo = null
			throw error
		}
		return String.create({ value: authUrlString })
	}
	async handleAuthCallback(_token, _provider) {
		try {
			this._authenticated = true
			await this.sendAuthStatusUpdate()
		} catch (error) {
			console.error("Error signing in with custom token:", error)
			throw error
		}
	}
	async restoreRefreshTokenAndRetrieveAuthInfo() {
		try {
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
}
//# sourceMappingURL=AuthServiceMock.js.map
