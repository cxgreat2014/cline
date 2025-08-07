import {
	WatchServiceClientImpl,
	WorkspaceServiceClientImpl,
	EnvServiceClientImpl,
	WindowServiceClientImpl,
	DiffServiceClientImpl,
} from "@generated/hosts/standalone/host-bridge-clients"
import { HOSTBRIDGE_PORT } from "@/standalone/protobus-service"
/**
 * Manager to hold the gRPC clients for the host bridge. The clients should be re-used to avoid
 * creating a new TCP connection every time a rpc is made.
 */
export class ExternalHostBridgeClientManager {
	watchServiceClient
	workspaceClient
	envClient
	windowClient
	diffClient
	constructor() {
		const address = process.env.HOST_BRIDGE_ADDRESS || `localhost:${HOSTBRIDGE_PORT}`
		this.watchServiceClient = new WatchServiceClientImpl(address)
		this.workspaceClient = new WorkspaceServiceClientImpl(address)
		this.envClient = new EnvServiceClientImpl(address)
		this.windowClient = new WindowServiceClientImpl(address)
		this.diffClient = new DiffServiceClientImpl(address)
	}
}
//# sourceMappingURL=host-bridge-client-manager.js.map
