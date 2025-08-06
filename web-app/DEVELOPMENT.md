# Cline Web Application 开发指南

## 快速开始

### 环境要求
- Node.js 18+ 
- npm 或 yarn
- Git
- Docker (可选，用于容器化部署)

### 本地开发设置

1. **克隆项目并切换到开发分支**
```bash
git clone <repository-url>
cd cline
git checkout feature/web-app-conversion
cd web-app
```

2. **安装依赖**
```bash
npm run install:all
```

3. **环境配置**
```bash
cp .env.example .env
# 编辑 .env 文件，填入必要的 API 密钥
```

4. **启动开发服务器**
```bash
npm run dev
```

这将同时启动：
- 后端服务器: http://localhost:8000
- 前端应用: http://localhost:3000

### 项目结构详解

```
web-app/
├── server/                 # 后端 Node.js 服务
│   ├── src/
│   │   ├── api/           # REST API 路由
│   │   │   ├── auth.ts    # 认证相关 API
│   │   │   ├── repositories.ts # 仓库管理 API
│   │   │   ├── tasks.ts   # 任务管理 API
│   │   │   └── files.ts   # 文件操作 API
│   │   ├── core/          # 核心业务逻辑
│   │   │   ├── ClineWebTask.ts # 任务执行引擎
│   │   │   ├── ApiHandler.ts   # AI API 处理
│   │   │   ├── ToolExecutor.ts # 工具执行器
│   │   │   └── PromptBuilder.ts # 提示词构建
│   │   ├── services/      # 业务服务层
│   │   │   ├── FileManager.ts    # 文件管理
│   │   │   ├── TerminalManager.ts # 终端管理
│   │   │   ├── SocketService.ts  # WebSocket 服务
│   │   │   └── ClineService.ts   # Cline 核心服务
│   │   ├── models/        # 数据模型 (TypeORM)
│   │   │   ├── User.ts
│   │   │   ├── Repository.ts
│   │   │   ├── Task.ts
│   │   │   └── Message.ts
│   │   ├── middleware/    # Express 中间件
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── rateLimiter.ts
│   │   └── utils/         # 工具函数
│   └── package.json
├── client/                # 前端 React 应用
│   ├── src/
│   │   ├── components/    # React 组件
│   │   │   ├── Layout.tsx
│   │   │   ├── Chat/      # 聊天相关组件
│   │   │   ├── Editor/    # 代码编辑器组件
│   │   │   ├── Terminal/  # 终端组件
│   │   │   └── FileTree/  # 文件树组件
│   │   ├── pages/         # 页面组件
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── RepositoryPage.tsx
│   │   │   └── TaskPage.tsx
│   │   ├── hooks/         # 自定义 Hooks
│   │   │   ├── useSocket.ts
│   │   │   ├── useAuth.ts
│   │   │   └── useRepository.ts
│   │   ├── services/      # API 服务
│   │   │   ├── api.ts
│   │   │   ├── authService.ts
│   │   │   └── socketService.ts
│   │   ├── store/         # 状态管理 (Zustand)
│   │   │   ├── authStore.ts
│   │   │   ├── repositoryStore.ts
│   │   │   └── taskStore.ts
│   │   └── utils/         # 工具函数
│   └── package.json
├── shared/                # 共享类型和工具
│   ├── types/
│   │   ├── api.ts
│   │   ├── task.ts
│   │   └── repository.ts
│   └── utils/
└── docker-compose.yml     # 容器编排配置
```

## 开发工作流

### 1. 功能开发流程

1. **创建功能分支**
```bash
git checkout -b feature/your-feature-name
```

2. **开发和测试**
```bash
# 启动开发服务器
npm run dev

# 运行测试
npm run test

# 代码检查
npm run lint
```

3. **提交代码**
```bash
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### 2. 核心组件开发

#### 后端 API 开发
```typescript
// server/src/api/example.ts
import { Router } from 'express'
import { authMiddleware } from '@middleware/auth'

const router = Router()

router.get('/', authMiddleware, async (req, res) => {
  try {
    // 业务逻辑
    res.json({ success: true, data: [] })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

export default router
```

#### 前端组件开发
```typescript
// client/src/components/ExampleComponent.tsx
import React from 'react'
import { useAuthStore } from '@store/authStore'

interface Props {
  title: string
}

const ExampleComponent: React.FC<Props> = ({ title }) => {
  const { user } = useAuthStore()
  
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">{title}</h1>
      <p>Welcome, {user?.username}!</p>
    </div>
  )
}

export default ExampleComponent
```

### 3. 数据库操作

#### 创建新模型
```typescript
// server/src/models/Example.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('examples')
export class Example {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @CreateDateColumn()
  createdAt: Date
}
```

#### 使用 Repository 模式
```typescript
// server/src/services/ExampleService.ts
import { AppDataSource } from '@/config/database'
import { Example } from '@models/Example'

export class ExampleService {
  private repository = AppDataSource.getRepository(Example)

  async create(data: Partial<Example>): Promise<Example> {
    const example = this.repository.create(data)
    return await this.repository.save(example)
  }

  async findAll(): Promise<Example[]> {
    return await this.repository.find()
  }
}
```

### 4. WebSocket 通信

#### 服务端事件发送
```typescript
// server/src/services/SocketService.ts
export class SocketService {
  emitToRepository(repositoryId: string, event: string, data: any) {
    this.io.to(`repo:${repositoryId}`).emit(event, data)
  }
}
```

#### 客户端事件监听
```typescript
// client/src/hooks/useSocket.ts
import { useEffect } from 'react'
import { useSocketStore } from '@store/socketStore'

export const useSocket = (repositoryId: string) => {
  const { socket } = useSocketStore()

  useEffect(() => {
    if (socket && repositoryId) {
      socket.emit('join-repository', repositoryId)
      
      socket.on('task:message', (data) => {
        // 处理任务消息
      })

      return () => {
        socket.emit('leave-repository', repositoryId)
        socket.off('task:message')
      }
    }
  }, [socket, repositoryId])
}
```

## 测试策略

### 1. 单元测试
```typescript
// server/src/services/__tests__/ExampleService.test.ts
import { ExampleService } from '../ExampleService'

describe('ExampleService', () => {
  let service: ExampleService

  beforeEach(() => {
    service = new ExampleService()
  })

  it('should create example', async () => {
    const data = { name: 'Test' }
    const result = await service.create(data)
    expect(result.name).toBe('Test')
  })
})
```

### 2. 集成测试
```typescript
// server/src/api/__tests__/example.test.ts
import request from 'supertest'
import { app } from '../app'

describe('Example API', () => {
  it('should get examples', async () => {
    const response = await request(app)
      .get('/api/examples')
      .expect(200)
    
    expect(response.body.success).toBe(true)
  })
})
```

### 3. 前端测试
```typescript
// client/src/components/__tests__/ExampleComponent.test.tsx
import { render, screen } from '@testing-library/react'
import ExampleComponent from '../ExampleComponent'

test('renders example component', () => {
  render(<ExampleComponent title="Test Title" />)
  const titleElement = screen.getByText(/Test Title/i)
  expect(titleElement).toBeInTheDocument()
})
```

## 部署指南

### 1. 开发环境部署
```bash
# 使用 Docker Compose
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 2. 生产环境部署
```bash
# 构建生产镜像
npm run docker:build

# 启动生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 3. 环境变量配置
生产环境需要配置以下关键环境变量：
- `JWT_SECRET`: JWT 密钥
- `ANTHROPIC_API_KEY`: Anthropic API 密钥
- `DATABASE_PATH`: 数据库文件路径
- `NODE_ENV=production`

## 调试技巧

### 1. 后端调试
```bash
# 启动调试模式
cd server
npm run dev

# 使用 VS Code 调试器
# 在 .vscode/launch.json 中配置调试选项
```

### 2. 前端调试
```bash
# 启动开发服务器
cd client
npm run dev

# 使用浏览器开发者工具
# React DevTools 扩展
```

### 3. 数据库调试
```bash
# 查看数据库内容
sqlite3 data/cline.db
.tables
.schema users
SELECT * FROM users;
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 编写测试
4. 确保代码通过 lint 检查
5. 提交 Pull Request

## 常见问题

### Q: 如何添加新的 AI 模型支持？
A: 在 `server/src/core/ApiHandler.ts` 中添加新的模型处理逻辑。

### Q: 如何扩展工具系统？
A: 在 `server/src/core/ToolExecutor.ts` 中添加新的工具实现。

### Q: 如何自定义前端主题？
A: 修改 `client/tailwind.config.js` 和相关 CSS 文件。

更多问题请查看项目 Issues 或创建新的 Issue。
