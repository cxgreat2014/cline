# Cline Web Application

## 概述

这是 Cline 的 Web 应用版本，将原本的 VSCode 扩展转换为独立的网页应用，支持多仓库管理和远程访问。

## 架构设计

```
cline-web/
├── server/                 # 后端服务
│   ├── src/
│   │   ├── core/          # 核心逻辑（从原 Cline 迁移）
│   │   ├── api/           # REST API 路由
│   │   ├── services/      # 业务服务层
│   │   ├── models/        # 数据模型
│   │   ├── middleware/    # 中间件
│   │   └── utils/         # 工具函数
│   ├── package.json
│   └── tsconfig.json
├── client/                # 前端应用
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── pages/         # 页面组件
│   │   ├── hooks/         # 自定义 Hooks
│   │   ├── services/      # API 服务
│   │   ├── store/         # 状态管理
│   │   └── utils/         # 工具函数
│   ├── package.json
│   └── vite.config.ts
├── shared/                # 共享类型和工具
│   ├── types/
│   └── utils/
├── docker-compose.yml     # 容器编排
├── Dockerfile            # 容器构建
└── README.md
```

## 核心功能

### 1. 仓库管理
- 添加/删除本地仓库
- 仓库权限控制
- 多仓库并行处理

### 2. 对话界面
- 实时聊天界面
- 支持文件上传和图片
- Markdown 渲染
- 代码高亮

### 3. 文件操作
- 文件树浏览
- 在线编辑器
- 文件差异对比
- 版本控制集成

### 4. 终端集成
- Web 终端模拟
- 命令执行和输出
- 多终端会话

### 5. 任务管理
- 任务历史记录
- 任务状态跟踪
- 检查点恢复

## 技术栈

### 后端
- **Node.js + TypeScript**: 服务端运行时
- **Express.js**: Web 框架
- **WebSocket**: 实时通信
- **SQLite**: 数据存储
- **node-pty**: 终端模拟
- **simple-git**: Git 操作
- **chokidar**: 文件监控

### 前端
- **React 18**: UI 框架
- **TypeScript**: 类型安全
- **Vite**: 构建工具
- **Tailwind CSS**: 样式框架
- **Monaco Editor**: 代码编辑器
- **xterm.js**: 终端组件
- **Socket.io**: WebSocket 客户端

### 部署
- **Docker**: 容器化
- **Nginx**: 反向代理
- **PM2**: 进程管理

## 开发计划

### Phase 1: 基础架构 (Week 1-2)
- [x] 创建项目结构
- [ ] 设置开发环境
- [ ] 实现基础 API 框架
- [ ] 创建前端基础组件

### Phase 2: 核心功能迁移 (Week 3-4)
- [ ] 迁移 Task 执行逻辑
- [ ] 实现工具系统
- [ ] 迁移提示词系统
- [ ] 实现文件操作 API

### Phase 3: 用户界面 (Week 5-6)
- [ ] 实现聊天界面
- [ ] 创建文件浏览器
- [ ] 集成代码编辑器
- [ ] 实现终端组件

### Phase 4: 高级功能 (Week 7-8)
- [ ] 实现 MCP 集成
- [ ] 添加用户认证
- [ ] 实现权限控制
- [ ] 优化性能

### Phase 5: 部署和测试 (Week 9-10)
- [ ] Docker 容器化
- [ ] 编写测试用例
- [ ] 性能优化
- [ ] 文档完善

## 快速开始

### 开发环境设置

```bash
# 克隆项目
git clone <repository-url>
cd cline-web

# 安装依赖
npm run install:all

# 启动开发服务器
npm run dev
```

### 生产环境部署

```bash
# 使用 Docker Compose
docker-compose up -d

# 或者手动构建
npm run build
npm run start
```

## API 设计

### 仓库管理
- `POST /api/repositories` - 添加仓库
- `GET /api/repositories` - 获取仓库列表
- `GET /api/repositories/:id` - 获取仓库详情
- `DELETE /api/repositories/:id` - 删除仓库

### 任务管理
- `POST /api/repositories/:id/tasks` - 创建任务
- `GET /api/repositories/:id/tasks` - 获取任务列表
- `GET /api/tasks/:taskId` - 获取任务详情
- `POST /api/tasks/:taskId/messages` - 发送消息

### 文件操作
- `GET /api/repositories/:id/files` - 获取文件列表
- `GET /api/repositories/:id/files/*` - 读取文件内容
- `PUT /api/repositories/:id/files/*` - 写入文件内容
- `DELETE /api/repositories/:id/files/*` - 删除文件

### WebSocket 事件
- `task:message` - 任务消息
- `task:status` - 任务状态更新
- `file:change` - 文件变更通知
- `terminal:output` - 终端输出

## 安全考虑

1. **路径安全**: 严格限制文件访问范围
2. **命令过滤**: 过滤危险的系统命令
3. **权限控制**: 基于角色的访问控制
4. **输入验证**: 严格验证所有用户输入
5. **会话管理**: 安全的用户会话处理

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

## 许可证

与原 Cline 项目保持一致的许可证。
