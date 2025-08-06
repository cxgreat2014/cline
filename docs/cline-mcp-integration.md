# Cline MCP 集成系统详解

## 概述

Model Context Protocol (MCP) 是一个开放协议，标准化了应用程序向大语言模型提供上下文的方式。Cline 通过 MCP 集成系统，能够连接到各种外部工具和数据源，大大扩展了其功能边界。

## MCP 架构概览

### 核心组件
```typescript
// src/services/mcp/McpHub.ts
export class McpHub {
    private connections: McpConnection[] = []
    private isConnecting: boolean = false
    private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map()
    
    constructor(
        private ensureMcpServersDirectoryExists: () => Promise<string>,
        private ensureSettingsDirectoryExists: () => Promise<string>,
        private extensionVersion: string
    ) {}
}
```

### MCP 连接类型
```typescript
interface McpConnection {
    client: Client
    server: McpServer
    source: "rpc" | "internal"
}

interface McpServer {
    name: string
    config: string // JSON 配置
    status: "connected" | "connecting" | "disconnected"
    error?: string
    tools?: McpTool[]
    resources?: McpResource[]
    resourceTemplates?: McpResourceTemplate[]
    disabled?: boolean
    timeout?: number
}
```

## MCP 服务器连接

### 连接类型支持
```typescript
// 支持的 MCP 传输类型
enum McpTransportType {
    STDIO = "stdio",    // 标准输入输出
    SSE = "sse",       // Server-Sent Events
    HTTP = "http"      // HTTP 流式传输
}
```

### Stdio 连接实现
```typescript
private async connectStdioServer(name: string, config: StdioConfig): Promise<void> {
    const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        cwd: config.cwd,
        env: {
            ...getDefaultEnvironment(),
            ...(config.env || {})
        },
        stderr: "pipe"
    })
    
    // 错误处理
    transport.onerror = async (error) => {
        console.error(`Transport error for "${name}":`, error)
        const connection = this.findConnection(name, "rpc")
        if (connection) {
            connection.server.status = "disconnected"
            this.appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`)
        }
        await this.notifyWebviewOfServerChanges()
    }
    
    // 创建客户端连接
    const client = new Client(
        {
            name: "Cline",
            version: this.extensionVersion
        },
        {
            capabilities: {
                tools: {},
                resources: {}
            }
        }
    )
    
    await client.connect(transport)
    
    // 保存连接
    this.connections.push({
        client,
        server: {
            name,
            config: JSON.stringify(config),
            status: "connected",
            tools: [],
            resources: [],
            resourceTemplates: []
        },
        source: "rpc"
    })
}
```

### SSE 连接实现
```typescript
private async connectSseServer(name: string, config: SseConfig): Promise<void> {
    const transport = new SSEClientTransport(new URL(config.url))
    
    const client = new Client(
        {
            name: "Cline",
            version: this.extensionVersion
        },
        {
            capabilities: {
                tools: {},
                resources: {}
            }
        }
    )
    
    await client.connect(transport)
    
    this.connections.push({
        client,
        server: {
            name,
            config: JSON.stringify(config),
            status: "connected",
            tools: [],
            resources: [],
            resourceTemplates: []
        },
        source: "rpc"
    })
}
```

## 工具和资源发现

### 工具列表获取
```typescript
private async fetchToolsList(serverName: string): Promise<McpTool[]> {
    const connection = this.findConnection(serverName, "rpc")
    if (!connection) {
        throw new Error(`No connection found for server: ${serverName}`)
    }
    
    try {
        const result = await connection.client.request(
            { method: "tools/list" },
            ListToolsResultSchema
        )
        
        return result.tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            autoApprove: false // 默认需要审批
        }))
    } catch (error) {
        console.error(`Failed to fetch tools for ${serverName}:`, error)
        return []
    }
}
```

### 资源列表获取
```typescript
private async fetchResourcesList(serverName: string): Promise<McpResource[]> {
    const connection = this.findConnection(serverName, "rpc")
    if (!connection) return []
    
    try {
        const result = await connection.client.request(
            { method: "resources/list" },
            ListResourcesResultSchema
        )
        
        return result.resources.map(resource => ({
            uri: resource.uri,
            name: resource.name,
            mimeType: resource.mimeType,
            description: resource.description
        }))
    } catch (error) {
        console.error(`Failed to fetch resources for ${serverName}:`, error)
        return []
    }
}
```

### 资源模板获取
```typescript
private async fetchResourceTemplatesList(serverName: string): Promise<McpResourceTemplate[]> {
    const connection = this.findConnection(serverName, "rpc")
    if (!connection) return []
    
    try {
        const result = await connection.client.request(
            { method: "resources/templates/list" },
            ListResourceTemplatesResultSchema
        )
        
        return result.resourceTemplates.map(template => ({
            uriTemplate: template.uriTemplate,
            name: template.name,
            description: template.description,
            mimeType: template.mimeType
        }))
    } catch (error) {
        console.error(`Failed to fetch resource templates for ${serverName}:`, error)
        return []
    }
}
```

## MCP 工具执行

### 工具调用实现
```typescript
async callTool(serverName: string, toolName: string, args: any): Promise<McpToolResponse> {
    const connection = this.connections.find(conn => conn.server.name === serverName)
    if (!connection) {
        throw new Error(`No connection found for server: ${serverName}`)
    }
    
    if (connection.server.disabled) {
        throw new Error(`Server "${serverName}" is disabled`)
    }
    
    // 检查工具是否存在
    const tool = connection.server.tools?.find(t => t.name === toolName)
    if (!tool) {
        throw new Error(`Tool "${toolName}" not found on server "${serverName}"`)
    }
    
    try {
        // 设置超时
        const timeout = connection.server.timeout || DEFAULT_MCP_TIMEOUT_SECONDS * 1000
        
        const result = await Promise.race([
            connection.client.request(
                {
                    method: "tools/call",
                    params: {
                        name: toolName,
                        arguments: args
                    }
                },
                CallToolResultSchema
            ),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`Tool call timed out after ${timeout}ms`)), timeout)
            )
        ]) as any
        
        return result
    } catch (error) {
        console.error(`Failed to call tool ${toolName} on server ${serverName}:`, error)
        throw error
    }
}
```

### 资源读取实现
```typescript
async readResource(serverName: string, uri: string): Promise<McpResourceResponse> {
    const connection = this.connections.find(conn => conn.server.name === serverName)
    if (!connection) {
        throw new Error(`No connection found for server: ${serverName}`)
    }
    
    if (connection.server.disabled) {
        throw new Error(`Server "${serverName}" is disabled`)
    }
    
    try {
        const result = await connection.client.request(
            {
                method: "resources/read",
                params: { uri }
            },
            ReadResourceResultSchema
        )
        
        return result
    } catch (error) {
        console.error(`Failed to read resource ${uri} from server ${serverName}:`, error)
        throw error
    }
}
```

## MCP 配置管理

### 配置文件结构
```typescript
interface McpSettings {
    mcpServers: {
        [serverName: string]: McpServerConfig
    }
}

interface McpServerConfig {
    type: "stdio" | "sse" | "http"
    command?: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
    url?: string
    disabled?: boolean
    timeout?: number
}
```

### 配置加载和保存
```typescript
private async loadMcpSettings(): Promise<McpSettings> {
    try {
        const settingsDir = await this.ensureSettingsDirectoryExists()
        const settingsPath = path.join(settingsDir, "mcp_settings.json")
        
        if (await fileExistsAtPath(settingsPath)) {
            const content = await fs.readFile(settingsPath, "utf8")
            return JSON.parse(content)
        }
        
        return { mcpServers: {} }
    } catch (error) {
        console.error("Failed to load MCP settings:", error)
        return { mcpServers: {} }
    }
}

private async saveMcpSettings(settings: McpSettings): Promise<void> {
    try {
        const settingsDir = await this.ensureSettingsDirectoryExists()
        const settingsPath = path.join(settingsDir, "mcp_settings.json")
        
        await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
    } catch (error) {
        console.error("Failed to save MCP settings:", error)
        throw error
    }
}
```

### 动态配置更新
```typescript
async updateServerConfig(serverName: string, config: McpServerConfig): Promise<void> {
    const settings = await this.loadMcpSettings()
    settings.mcpServers[serverName] = config
    
    await this.saveMcpSettings(settings)
    
    // 重新连接服务器
    await this.reconnectServer(serverName)
    
    // 通知 UI 更新
    await this.notifyWebviewOfServerChanges()
}
```

## 文件监控和自动重连

### 配置文件监控
```typescript
private setupFileWatcher(serverName: string, config: StdioConfig): void {
    if (!config.command) return
    
    // 监控可执行文件变化
    const executablePath = config.command
    if (path.isAbsolute(executablePath)) {
        const watcher = vscode.workspace.createFileSystemWatcher(executablePath)
        
        watcher.onDidChange(async () => {
            console.log(`MCP server executable changed: ${serverName}`)
            await this.reconnectServer(serverName)
        })
        
        this.fileWatchers.set(serverName, watcher)
    }
}
```

### 自动重连机制
```typescript
private async reconnectServer(serverName: string): Promise<void> {
    try {
        // 断开现有连接
        await this.deleteConnection(serverName)
        
        // 重新加载配置
        const settings = await this.loadMcpSettings()
        const config = settings.mcpServers[serverName]
        
        if (config && !config.disabled) {
            // 重新连接
            await this.connectToServer(serverName, config, "rpc")
            console.log(`Successfully reconnected MCP server: ${serverName}`)
        }
    } catch (error) {
        console.error(`Failed to reconnect MCP server ${serverName}:`, error)
    }
}
```

## MCP 市场集成

### 市场服务器下载
```typescript
// src/core/controller/mcp/downloadMcp.ts
export async function downloadMcp(controller: Controller, request: StringRequest): Promise<McpDownloadResponse> {
    const mcpId = request.value
    
    try {
        // 1. 从市场获取服务器信息
        const response = await axios.post<McpDownloadResponse>(
            "https://api.cline.bot/v1/mcp/download",
            { mcpId },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 10000
            }
        )
        
        const mcpDetails = response.data
        
        // 2. 创建安装任务
        const task = `Set up the MCP server from ${mcpDetails.githubUrl}. 

Here's what you need to do:
1. Clone or download the repository
2. Follow the installation instructions
3. Configure the MCP server in Cline's settings
4. Test the connection

Repository: ${mcpDetails.githubUrl}
Description: ${mcpDetails.description}

${mcpDetails.readme ? `README content:\n${mcpDetails.readme}` : ""}`
        
        // 3. 初始化任务
        await controller.initTask(task)
        
        return mcpDetails
        
    } catch (error) {
        console.error("Failed to download MCP server:", error)
        throw new Error(`Failed to download MCP server: ${error instanceof Error ? error.message : String(error)}`)
    }
}
```

### 市场目录刷新
```typescript
async refreshMcpMarketplace(): Promise<McpMarketplaceCatalog> {
    try {
        const response = await axios.get<McpMarketplaceCatalog>(
            "https://api.cline.bot/v1/mcp/catalog",
            {
                headers: { "Content-Type": "application/json" },
                timeout: 10000
            }
        )
        
        return response.data
    } catch (error) {
        console.error("Failed to refresh MCP marketplace:", error)
        throw new Error(`Failed to refresh MCP marketplace: ${error instanceof Error ? error.message : String(error)}`)
    }
}
```

## 安全和权限管理

### 工具自动审批
```typescript
async toggleToolAutoApprove(serverName: string, toolName: string, autoApprove: boolean): Promise<void> {
    const connection = this.findConnection(serverName, "rpc")
    if (!connection) {
        throw new Error(`No connection found for server: ${serverName}`)
    }
    
    const tool = connection.server.tools?.find(t => t.name === toolName)
    if (!tool) {
        throw new Error(`Tool "${toolName}" not found on server "${serverName}"`)
    }
    
    // 更新工具的自动审批设置
    tool.autoApprove = autoApprove
    
    // 保存到配置
    await this.saveToolAutoApprovalSettings(serverName, toolName, autoApprove)
    
    // 通知 UI 更新
    await this.notifyWebviewOfServerChanges()
}
```

### 服务器禁用/启用
```typescript
async toggleServer(serverName: string, enabled: boolean): Promise<void> {
    const settings = await this.loadMcpSettings()
    const config = settings.mcpServers[serverName]
    
    if (!config) {
        throw new Error(`Server configuration not found: ${serverName}`)
    }
    
    config.disabled = !enabled
    await this.saveMcpSettings(settings)
    
    if (enabled) {
        // 启用服务器 - 重新连接
        await this.connectToServer(serverName, config, "rpc")
    } else {
        // 禁用服务器 - 断开连接
        await this.deleteConnection(serverName)
    }
    
    await this.notifyWebviewOfServerChanges()
}
```

## 错误处理和监控

### 连接健康检查
```typescript
private async performHealthCheck(): Promise<void> {
    for (const connection of this.connections) {
        try {
            // 发送 ping 请求检查连接状态
            await connection.client.request(
                { method: "ping" },
                undefined,
                5000 // 5秒超时
            )
            
            if (connection.server.status !== "connected") {
                connection.server.status = "connected"
                connection.server.error = undefined
            }
        } catch (error) {
            console.error(`Health check failed for ${connection.server.name}:`, error)
            connection.server.status = "disconnected"
            connection.server.error = error instanceof Error ? error.message : String(error)
        }
    }
    
    await this.notifyWebviewOfServerChanges()
}
```

### 错误恢复
```typescript
private async handleConnectionError(serverName: string, error: Error): Promise<void> {
    console.error(`Connection error for MCP server ${serverName}:`, error)
    
    const connection = this.findConnection(serverName, "rpc")
    if (connection) {
        connection.server.status = "disconnected"
        this.appendErrorMessage(connection, error.message)
    }
    
    // 尝试自动重连（最多3次）
    let retryCount = 0
    const maxRetries = 3
    
    while (retryCount < maxRetries) {
        try {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))) // 递增延迟
            await this.reconnectServer(serverName)
            break
        } catch (retryError) {
            retryCount++
            console.error(`Retry ${retryCount} failed for ${serverName}:`, retryError)
        }
    }
    
    if (retryCount >= maxRetries) {
        console.error(`Failed to reconnect ${serverName} after ${maxRetries} attempts`)
    }
    
    await this.notifyWebviewOfServerChanges()
}
```

这个 MCP 集成系统为 Cline 提供了强大的扩展能力，使其能够连接到各种外部工具和服务，大大扩展了功能边界。
