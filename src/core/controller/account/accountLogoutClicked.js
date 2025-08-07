import { AuthService } from "@/services/auth/AuthService"
import { Empty } from "@shared/proto/cline/common"
const authService = AuthService.getInstance()
/**
 * Handles the account logout action
 * @param controller The controller instance
 * @param _request The empty request object
 * @returns Empty response
 */
export async function accountLogoutClicked(controller, _request) {
	await controller.handleSignOut()
	await authService.handleDeauth()
	return Empty.create({})
}
//# sourceMappingURL=accountLogoutClicked.js.map
