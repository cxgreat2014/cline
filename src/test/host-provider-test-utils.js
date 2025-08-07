import { HostProvider } from "@/hosts/host-provider"
import { vscodeHostBridgeClient } from "@/hosts/vscode/hostbridge/client/host-grpc-client"
/**
 * Initializes the HostProvider with test defaults.
 * This is a common setup used across multiple test files.
 *
 * @param options Optional overrides for the default test configuration
 */
export function setVscodeHostProviderMock(options) {
	HostProvider.reset()
	HostProvider.initialize(
		options?.webviewProviderCreator ?? ((_) => {}),
		options?.diffViewProviderCreator ?? (() => {}),
		options?.hostBridgeClient ?? vscodeHostBridgeClient,
		options?.logToChannel ?? ((_) => {}),
		options?.getCallbackUri ?? (async () => "http://example.com:1234/"),
	)
}
//# sourceMappingURL=host-provider-test-utils.js.map
