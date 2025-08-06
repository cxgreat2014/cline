# Cline 计划模式与执行模式详解

## 概述

Cline 实现了创新的双模式系统，将任务处理分为计划模式(Plan Mode)和执行模式(Act Mode)。这种设计分离了思考和行动，让 AI 能够更好地理解需求、制定计划，然后高效执行。

## 双模式架构

### 模式定义
```typescript
// src/shared/storage/types.ts
export type Mode = "plan" | "act"

// 模式状态管理
interface ModeState {
    currentMode: Mode
    planModeApiConfig?: ApiConfiguration
    actModeApiConfig?: ApiConfiguration
    strictPlanModeEnabled: boolean
}
```

### 模式切换机制
```typescript
// src/core/controller/index.ts
async togglePlanActMode(modeToSwitchTo: Mode, chatContent?: ChatContent): Promise<boolean> {
    const didSwitchToActMode = modeToSwitchTo === "act"
    
    // 1. 保存当前模式的 API 配置
    await this.saveModeSpecificApiConfig(this.currentMode)
    
    // 2. 切换到新模式
    await updateGlobalState(this.context, "mode", modeToSwitchTo)
    
    // 3. 恢复新模式的 API 配置
    await this.restoreModeSpecificApiConfig(modeToSwitchTo)
    
    // 4. 更新任务实例
    if (this.task) {
        const apiConfiguration = this.cacheService.getApiConfiguration()
        this.task.api = buildApiHandler({ ...apiConfiguration, taskId: this.task.taskId }, modeToSwitchTo)
        this.task.mode = modeToSwitchTo
    }
    
    // 5. 发送模式切换消息
    if (chatContent) {
        await this.sendModeTransitionMessage(modeToSwitchTo, chatContent)
    }
    
    // 6. 记录遥测数据
    telemetryService.captureModeSwitch(this.task?.taskId ?? "0", modeToSwitchTo)
    
    return didSwitchToActMode
}
```

## 计划模式 (Plan Mode)

### 设计理念
计划模式专注于：
- **需求理解**: 深入理解用户需求和上下文
- **方案设计**: 制定详细的实现方案
- **风险评估**: 识别潜在问题和挑战
- **用户沟通**: 与用户讨论和确认方案

### 工具限制
```typescript
// 计划模式下的工具限制
const PLAN_MODE_RESTRICTED_TOOLS = [
    "execute_command",
    "write_to_file", 
    "browser_action",
    "use_mcp_tool" // 某些 MCP 工具
]

// 计划模式专用工具
const PLAN_MODE_TOOLS = [
    "plan_mode_respond", // 计划模式响应工具
    "read_file",         // 文件读取（分析用）
    "list_files",        // 文件列表（了解结构）
    "list_code_definition_names" // 代码分析
]
```

### 计划模式提示词
```typescript
// src/core/prompts/model_prompts/claude4.ts
const PLAN_MODE_SYSTEM_PROMPT = `
You are in Plan Mode. Your role is to:

1. UNDERSTAND the user's requirements thoroughly
2. ANALYZE the existing codebase and context
3. DESIGN a comprehensive implementation plan
4. DISCUSS potential approaches with the user
5. IDENTIFY risks and challenges

In Plan Mode, you should:
- Ask clarifying questions when requirements are unclear
- Read and analyze relevant files to understand the context
- Propose detailed step-by-step implementation plans
- Discuss trade-offs and alternative approaches
- Seek user confirmation before moving to implementation

You CANNOT:
- Execute commands or make file changes
- Use browser automation tools
- Perform destructive operations

Use the plan_mode_respond tool to communicate your analysis and plans.
`
```

### 计划模式工具实现
```typescript
// 计划模式响应工具
case "plan_mode_respond": {
    const response: string | undefined = block.params.response
    
    if (block.partial) {
        await this.say("text", this.removeClosingTag(block, "response", response), undefined, undefined, true)
        break
    } else {
        if (!response) {
            this.taskState.consecutiveMistakeCount++
            this.pushToolResult(await this.sayAndCreateMissingParamError("plan_mode_respond", "response"), block)
            await this.saveCheckpoint()
            break
        }
        
        this.taskState.consecutiveMistakeCount = 0
        
        // 显示计划响应
        await this.say("text", response)
        
        // 询问用户是否切换到执行模式
        const shouldSwitchToAct = await this.ask(
            "plan_mode_switch",
            "Would you like me to switch to Act mode to implement this plan?",
            false
        )
        
        if (shouldSwitchToAct.response === "yesButtonClicked") {
            await this.switchToActMode()
        }
        
        this.pushToolResult(formatResponse.toolResult("Plan communicated to user"), block)
        await this.saveCheckpoint()
        break
    }
}
```

## 执行模式 (Act Mode)

### 设计理念
执行模式专注于：
- **方案实施**: 执行既定的实现方案
- **代码编写**: 创建和修改代码文件
- **命令执行**: 运行构建、测试等命令
- **问题解决**: 处理实施过程中的问题

### 完整工具访问
```typescript
// 执行模式下可用的所有工具
const ACT_MODE_TOOLS = [
    "execute_command",
    "read_file",
    "write_to_file",
    "list_files",
    "list_code_definition_names",
    "browser_action",
    "use_mcp_tool",
    "access_mcp_resource",
    "new_task",
    "condense"
]
```

### 执行模式提示词
```typescript
const ACT_MODE_SYSTEM_PROMPT = `
You are in Act Mode. Your role is to:

1. IMPLEMENT the planned solution efficiently
2. WRITE and modify code files as needed
3. EXECUTE commands to build, test, and deploy
4. SOLVE problems that arise during implementation
5. PROVIDE progress updates and results

In Act Mode, you should:
- Focus on implementation rather than extensive planning
- Make necessary file changes and execute commands
- Handle errors and edge cases as they occur
- Provide clear progress updates
- Complete the task efficiently

You have access to all tools including:
- File operations (read, write, list)
- Command execution
- Browser automation
- MCP tools and resources
- Code analysis tools

Work systematically through the implementation plan.
`
```

## 模式转换流程

### 从计划到执行
```typescript
private async switchToActMode(): Promise<void> {
    // 1. 保存计划模式的上下文
    await this.savePlanModeContext()
    
    // 2. 切换模式
    await this.controllerRef.deref()?.togglePlanActMode("act")
    
    // 3. 传递计划上下文到执行模式
    const planContext = await this.getPlanModeContext()
    
    // 4. 构建执行模式的初始消息
    const actModeMessage = this.buildActModeInitialMessage(planContext)
    
    // 5. 开始执行模式任务循环
    await this.initiateTaskLoop(actModeMessage)
}
```

### 从执行回到计划
```typescript
private async switchToPlanMode(): Promise<void> {
    // 1. 保存执行进度
    await this.saveExecutionProgress()
    
    // 2. 切换模式
    await this.controllerRef.deref()?.togglePlanActMode("plan")
    
    // 3. 分析当前状态
    const currentState = await this.analyzeCurrentState()
    
    // 4. 构建计划模式消息
    const planModeMessage = this.buildPlanModeReentryMessage(currentState)
    
    // 5. 开始计划模式任务循环
    await this.initiateTaskLoop(planModeMessage)
}
```

## 严格计划模式

### 配置选项
```typescript
interface StrictPlanModeSettings {
    enabled: boolean
    requireExplicitApproval: boolean
    preventAutoSwitch: boolean
}
```

### 严格模式实现
```typescript
// 严格计划模式下的额外限制
if (this.strictPlanModeEnabled && this.mode === "plan") {
    // 1. 禁止自动切换到执行模式
    if (toolName === "plan_mode_respond") {
        // 不提供自动切换选项
        this.pushToolResult(formatResponse.toolResult("Plan communicated. Please manually switch to Act mode when ready."), block)
        return
    }
    
    // 2. 更严格的工具限制
    const restrictedTools = [...PLAN_MODE_RESTRICTED_TOOLS, "new_task", "condense"]
    if (restrictedTools.includes(toolName)) {
        this.pushToolResult(formatResponse.toolError("This tool is not available in strict Plan mode"), block)
        return
    }
}
```

## 模式特定的 API 配置

### 分离的模型配置
```typescript
// 支持为不同模式配置不同的模型
interface ModeSpecificApiConfig {
    planMode: {
        provider: string
        model: string
        // 计划模式可能使用更强的推理模型
    }
    actMode: {
        provider: string
        model: string
        // 执行模式可能使用更快的模型
    }
}
```

### 配置管理
```typescript
private async saveModeSpecificApiConfig(mode: Mode): Promise<void> {
    const currentConfig = this.cacheService.getApiConfiguration()
    
    if (mode === "plan") {
        await updateGlobalState(this.context, "planModeApiConfig", currentConfig)
    } else {
        await updateGlobalState(this.context, "actModeApiConfig", currentConfig)
    }
}

private async restoreModeSpecificApiConfig(mode: Mode): Promise<void> {
    let savedConfig: ApiConfiguration | undefined
    
    if (mode === "plan") {
        savedConfig = await getGlobalState(this.context, "planModeApiConfig") as ApiConfiguration
    } else {
        savedConfig = await getGlobalState(this.context, "actModeApiConfig") as ApiConfiguration
    }
    
    if (savedConfig) {
        this.cacheService.setApiConfiguration(savedConfig)
    }
}
```

## 用户体验优化

### 模式指示器
```typescript
// UI 中显示当前模式
interface WebviewState {
    mode: Mode
    canSwitchMode: boolean
    modeTransitionMessage?: string
}
```

### 智能模式建议
```typescript
private suggestModeSwitch(currentMode: Mode, taskContext: TaskContext): Mode | null {
    if (currentMode === "plan") {
        // 如果已有详细计划，建议切换到执行模式
        if (taskContext.hasDetailedPlan && taskContext.userApprovedPlan) {
            return "act"
        }
    } else {
        // 如果遇到复杂问题，建议切换到计划模式
        if (taskContext.consecutiveErrors > 2 || taskContext.requiresReplanning) {
            return "plan"
        }
    }
    
    return null
}
```

### 上下文保持
```typescript
// 在模式切换时保持上下文连续性
private buildModeTransitionContext(fromMode: Mode, toMode: Mode): string {
    const context = {
        previousMode: fromMode,
        taskProgress: this.getTaskProgress(),
        keyDecisions: this.getKeyDecisions(),
        remainingWork: this.getRemainingWork()
    }
    
    return `
Switching from ${fromMode} mode to ${toMode} mode.

Previous work summary:
${context.taskProgress}

Key decisions made:
${context.keyDecisions}

Remaining work:
${context.remainingWork}
`
}
```

## 最佳实践

### 计划模式最佳实践
1. **充分理解**: 在开始实施前充分理解需求
2. **详细分析**: 分析现有代码和架构
3. **风险识别**: 提前识别潜在问题
4. **用户确认**: 获得用户对方案的确认

### 执行模式最佳实践
1. **按计划执行**: 严格按照计划进行实施
2. **增量实现**: 分步骤实现功能
3. **及时测试**: 实现后及时测试验证
4. **问题反馈**: 遇到问题及时反馈用户

### 模式切换时机
- **计划 → 执行**: 方案明确且获得用户确认后
- **执行 → 计划**: 遇到重大问题或需要重新规划时
- **灵活切换**: 根据任务复杂度灵活选择模式

这种双模式设计让 Cline 能够更好地处理复杂任务，既保证了方案的合理性，又提高了执行的效率。
