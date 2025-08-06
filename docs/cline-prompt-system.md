# Cline 提示词系统详解

## 概述

Cline 的提示词系统是其核心组件之一，负责构建发送给 AI 模型的系统提示词。该系统动态生成包含工具定义、环境信息、用户指令等内容的完整提示词，确保 AI 能够准确理解任务要求并正确使用工具。

## 提示词架构

### 核心组件
```typescript
// src/core/prompts/system.ts
export const SYSTEM_PROMPT = async (
    cwd: string,
    supportsBrowserUse: boolean,
    mcpHub: McpHub,
    browserSettings: BrowserSettings,
    isNextGenModel: boolean = false
) => {
    // 根据模型类型选择不同的提示词版本
    if (isNextGenModel && USE_EXPERIMENTAL_CLAUDE4_FEATURES) {
        return SYSTEM_PROMPT_CLAUDE4_EXPERIMENTAL(...)
    }
    if (isNextGenModel) {
        return SYSTEM_PROMPT_CLAUDE4(...)
    }
    return SYSTEM_PROMPT_DEFAULT(...)
}
```

### 提示词版本
1. **默认版本**: 适用于大多数模型的通用提示词
2. **Claude 4 版本**: 针对 Claude 4 优化的提示词
3. **实验版本**: 包含最新功能的实验性提示词

## 提示词结构

### 1. 角色定义
```
You are Cline, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.
```

**关键特点**:
- 明确定义 AI 的身份和能力
- 强调专业技能和知识广度
- 建立用户对 AI 能力的期望

### 2. 工具定义部分

#### 内置工具
```xml
<execute_command>
<command>npm run dev</command>
<requires_approval>false</requires_approval>
</execute_command>
```

**主要工具类型**:
- **execute_command**: 执行命令行操作
- **read_file**: 读取文件内容
- **write_to_file**: 写入文件内容
- **list_files**: 列出目录内容
- **list_code_definition_names**: 列出代码定义
- **browser_action**: 浏览器操作（如果启用）

#### 工具参数说明
每个工具都包含详细的参数说明：
- **必需参数**: 工具正常工作必须的参数
- **可选参数**: 增强功能的可选参数
- **参数类型**: 字符串、布尔值、对象等
- **参数描述**: 详细说明参数的用途和格式

### 3. MCP 工具集成

#### 动态工具发现
```typescript
// 动态添加 MCP 服务器提供的工具
${mcpHub.getServers().length > 0
    ? mcpHub.getServers()
        .filter(server => server.status === "connected")
        .map(server => {
            const tools = server.tools?.map(tool => {
                return `- ${tool.name}: ${tool.description}\n${tool.inputSchema ? JSON.stringify(tool.inputSchema, null, 2) : ""}`
            }).join('\n\n')
            return `## ${server.name}\n### Available Tools\n${tools}`
        }).join('\n\n')
    : "(No MCP servers currently connected)"
}
```

**MCP 集成特点**:
- **实时发现**: 动态发现连接的 MCP 服务器
- **工具注册**: 自动注册 MCP 提供的工具
- **资源访问**: 支持访问 MCP 资源和模板
- **状态监控**: 监控 MCP 服务器连接状态

### 4. 环境信息部分

#### 系统信息
```typescript
SYSTEM INFORMATION

Operating System: ${osName()}
Default Shell: ${getShell()}
Home Directory: ${os.homedir().toPosix()}
Current Working Directory: ${cwd.toPosix()}
```

#### 浏览器配置
```typescript
// 如果启用浏览器工具
${supportsBrowserUse ? `
BROWSER AUTOMATION

You have access to browser automation capabilities through the browser_action tool.
- Viewport: ${browserSettings.viewport.width}x${browserSettings.viewport.height}
- User Agent: Custom user agent for compatibility
` : ""}
```

### 5. 用户自定义指令

#### .clinerules 集成
```typescript
export function addUserInstructions(
    globalClineRulesFileInstructions?: string,
    localClineRulesFileInstructions?: string,
    localCursorRulesFileInstructions?: string,
    // ... 其他规则文件
) {
    let customInstructions = ""
    
    // 按优先级添加各种用户指令
    if (preferredLanguageInstructions) {
        customInstructions += preferredLanguageInstructions + "\n\n"
    }
    if (globalClineRulesFileInstructions) {
        customInstructions += globalClineRulesFileInstructions + "\n\n"
    }
    // ... 其他指令
    
    return `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${customInstructions.trim()}`
}
```

#### 指令优先级
1. **首选语言指令**: 用户的语言偏好
2. **全局 Cline 规则**: 全局配置的规则
3. **本地 Cline 规则**: 项目特定的规则
4. **外部工具规则**: Cursor、Windsurf 等工具的规则
5. **忽略文件指令**: .clineignore 文件内容

### 6. 操作指南部分

#### 工具使用最佳实践
```
TOOL USE GUIDELINES

- Always use the most appropriate tool for each task
- Provide complete file content when writing files
- Use relative paths when possible
- Request approval for potentially destructive operations
- Handle errors gracefully and provide helpful feedback
```

#### 特殊场景处理
- **文件操作**: 读取前检查存在性，写入时提供完整内容
- **命令执行**: 考虑操作系统兼容性，使用适当的命令
- **错误处理**: 提供清晰的错误信息和解决建议

## 模型特定优化

### Claude 4 优化
```typescript
// src/core/prompts/model_prompts/claude4.ts
export const SYSTEM_PROMPT_CLAUDE4 = async (...) => {
    return `You are Cline, a highly skilled software engineer...
    
    # Advanced Capabilities
    - Enhanced reasoning for complex problems
    - Better code understanding and generation
    - Improved error handling and debugging
    
    # Tool Use Examples
    ## Example 1: Creating a new task
    <new_task>
    <context>
    1. Current Work: [Detailed description]
    2. Key Technical Concepts: [Concept list]
    </context>
    </new_task>
    `
}
```

### Gemini 2.5 优化
- **多模态处理**: 优化图片和文档处理能力
- **长上下文**: 利用更大的上下文窗口
- **推理增强**: 加强逻辑推理指导

### 实验性功能
```typescript
// Claude 4 实验性功能
if (USE_EXPERIMENTAL_CLAUDE4_FEATURES) {
    // 启用 JSON 流式输出
    // 增强工具调用能力
    // 实验性推理模式
}
```

## 动态提示词构建

### 上下文感知构建
```typescript
class Task {
    private async buildSystemPrompt(): Promise<string> {
        // 1. 检测模型能力
        const modelInfo = this.api.getModel()
        const supportsImages = modelInfo.info.supportsImages
        const isNextGen = this.isNextGenModel()
        
        // 2. 收集环境信息
        const cwd = this.cwd
        const browserSettings = this.browserSettings
        const mcpHub = this.mcpHub
        
        // 3. 构建提示词
        let systemPrompt = await SYSTEM_PROMPT(
            cwd, 
            supportsImages && !this.browserSettings.disableToolUse,
            mcpHub,
            browserSettings,
            isNextGen
        )
        
        // 4. 添加用户指令
        const userInstructions = await this.collectUserInstructions()
        if (userInstructions) {
            systemPrompt += addUserInstructions(userInstructions)
        }
        
        return systemPrompt
    }
}
```

### 缓存机制
- **提示词缓存**: 缓存构建好的提示词避免重复计算
- **增量更新**: 只在相关配置变更时重新构建
- **版本管理**: 跟踪提示词版本确保一致性

## 提示词优化策略

### 1. Token 效率
- **精简描述**: 使用简洁但准确的工具描述
- **示例优化**: 提供典型而非冗余的使用示例
- **结构化格式**: 使用清晰的结构减少解析复杂度

### 2. 理解准确性
- **明确指令**: 避免歧义的表达
- **上下文关联**: 确保各部分内容逻辑连贯
- **优先级明确**: 清楚标明重要性和优先级

### 3. 工具使用引导
- **使用场景**: 明确每个工具的适用场景
- **参数示例**: 提供典型的参数使用示例
- **错误预防**: 预先说明常见错误和避免方法

## 质量保证

### 1. 提示词验证
- **语法检查**: 确保提示词语法正确
- **逻辑验证**: 验证指令逻辑的一致性
- **工具测试**: 测试工具定义的准确性

### 2. 性能监控
- **响应质量**: 监控 AI 响应的质量
- **工具使用**: 跟踪工具使用的准确性
- **错误率**: 监控提示词导致的错误

### 3. 持续优化
- **用户反馈**: 收集用户使用反馈
- **模型适配**: 根据新模型特性调整提示词
- **功能迭代**: 随功能更新同步优化提示词

这个提示词系统确保 Cline 能够充分发挥 AI 模型的能力，准确理解用户需求并正确执行各种任务。
