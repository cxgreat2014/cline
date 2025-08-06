<div align="center"><sub>
English | <a href="https://github.com/cline/cline/blob/main/locales/es/README.md" target="_blank">Español</a> | <a href="https://github.com/cline/cline/blob/main/locales/de/README.md" target="_blank">Deutsch</a> | <a href="https://github.com/cline/cline/blob/main/locales/ja/README.md" target="_blank">日本語</a> | <a href="https://github.com/cline/cline/blob/main/locales/zh-cn/README.md" target="_blank">简体中文</a> | <a href="https://github.com/cline/cline/blob/main/locales/zh-tw/README.md" target="_blank">繁體中文</a> | <a href="https://github.com/cline/cline/blob/main/locales/ko/README.md" target="_blank">한국어</a>
</sub></div>

# Cline – \#1 on OpenRouter

<p align="center">
  <img src="https://media.githubusercontent.com/media/cline/cline/main/assets/docs/demo.gif" width="100%" />
</p>

<div align="center">
<table>
<tbody>
<td align="center">
<a href="https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev" target="_blank"><strong>Download on VS Marketplace</strong></a>
</td>
<td align="center">
<a href="https://discord.gg/cline" target="_blank"><strong>Discord</strong></a>
</td>
<td align="center">
<a href="https://www.reddit.com/r/cline/" target="_blank"><strong>r/cline</strong></a>
</td>
<td align="center">
<a href="https://github.com/cline/cline/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop" target="_blank"><strong>Feature Requests</strong></a>
</td>
<td align="center">
<a href="https://docs.cline.bot/getting-started/for-new-coders" target="_blank"><strong>Getting Started</strong></a>
</td>
</tbody>
</table>
</div>

Meet Cline (pronounced /klaɪn/, like "Klein"), an AI assistant that can use your **CLI** a**N**d **E**ditor.

Thanks to [Claude 3.7 Sonnet's agentic coding capabilities](https://www.anthropic.com/claude/sonnet), Cline can handle complex software development tasks step-by-step. With tools that let him create & edit files, explore large projects, use the browser, and execute terminal commands (after you grant permission), he can assist you in ways that go beyond code completion or tech support. Cline can even use the Model Context Protocol (MCP) to create new tools and extend his own capabilities. While autonomous AI scripts traditionally run in sandboxed environments, this extension provides a human-in-the-loop GUI to approve every file change and terminal command, providing a safe and accessible way to explore the potential of agentic AI.

## 🏗️ 项目架构

Cline采用现代化的分层架构设计，主要包括：

- **核心扩展** (`src/`): TypeScript编写的VS Code扩展主体
- **Webview UI** (`webview-ui/`): React构建的用户界面
- **API集成**: 支持30+个AI提供商的统一接口
- **MCP协议**: 可扩展的工具生态系统
- **gRPC通信**: 高效的组件间通信

📖 **[查看详细项目设计文档](docs/project-overview.md)**

1. Enter your task and add images to convert mockups into functional apps or fix bugs with screenshots.
2. Cline starts by analyzing your file structure & source code ASTs, running regex searches, and reading relevant files to get up to speed in existing projects. By carefully managing what information is added to context, Cline can provide valuable assistance even for large, complex projects without overwhelming the context window.
3. Once Cline has the information he needs, he can:
    - Create and edit files + monitor linter/compiler errors along the way, letting him proactively fix issues like missing imports and syntax errors on his own.
    - Execute commands directly in your terminal and monitor their output as he works, letting him e.g., react to dev server issues after editing a file.
    - For web development tasks, Cline can launch the site in a headless browser, click, type, scroll, and capture screenshots + console logs, allowing him to fix runtime errors and visual bugs.
4. When a task is completed, Cline will present the result to you with a terminal command like `open -a "Google Chrome" index.html`, which you run with a click of a button.

> [!TIP]
> Use the `CMD/CTRL + Shift + P` shortcut to open the command palette and type "Cline: Open In New Tab" to open the extension as a tab in your editor. This lets you use Cline side-by-side with your file explorer, and see how he changes your workspace more clearly.

---

## 🛠️ 技术栈

### 后端 (Extension Host)
- **TypeScript** + **Node.js** - 类型安全的扩展开发
- **30+ AI提供商集成** - Anthropic, OpenAI, Google Gemini, AWS Bedrock等
- **gRPC + Protocol Buffers** - 高效的组件间通信
- **MCP (Model Context Protocol)** - 可扩展的工具生态

### 前端 (Webview UI)
- **React 18** + **TypeScript** - 现代化的用户界面
- **Vite** - 快速的构建工具
- **Tailwind CSS** - 实用优先的样式框架

### 核心能力
- **智能上下文管理** - 高效处理大型项目
- **检查点系统** - 工作区状态快照和恢复
- **浏览器自动化** - Computer Use能力支持
- **安全的人机协作** - 所有操作需用户确认

---

<img align="right" width="340" src="https://github.com/user-attachments/assets/3cf21e04-7ce9-4d22-a7b9-ba2c595e88a4">

### Use any API and Model

Cline supports API providers like OpenRouter, Anthropic, OpenAI, Google Gemini, AWS Bedrock, Azure, GCP Vertex, Cerebras and Groq. You can also configure any OpenAI compatible API, or use a local model through LM Studio/Ollama. If you're using OpenRouter, the extension fetches their latest model list, allowing you to use the newest models as soon as they're available.

The extension also keeps track of total tokens and API usage cost for the entire task loop and individual requests, keeping you informed of spend every step of the way.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="370" src="https://github.com/user-attachments/assets/81be79a8-1fdb-4028-9129-5fe055e01e76">

### Run Commands in Terminal

Thanks to the new [shell integration updates in VSCode v1.93](https://code.visualstudio.com/updates/v1_93#_terminal-shell-integration-api), Cline can execute commands directly in your terminal and receive the output. This allows him to perform a wide range of tasks, from installing packages and running build scripts to deploying applications, managing databases, and executing tests, all while adapting to your dev environment & toolchain to get the job done right.

For long running processes like dev servers, use the "Proceed While Running" button to let Cline continue in the task while the command runs in the background. As Cline works he’ll be notified of any new terminal output along the way, letting him react to issues that may come up, such as compile-time errors when editing files.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="400" src="https://github.com/user-attachments/assets/c5977833-d9b8-491e-90f9-05f9cd38c588">

### Create and Edit Files

Cline can create and edit files directly in your editor, presenting you a diff view of the changes. You can edit or revert Cline's changes directly in the diff view editor, or provide feedback in chat until you're satisfied with the result. Cline also monitors linter/compiler errors (missing imports, syntax errors, etc.) so he can fix issues that come up along the way on his own.

All changes made by Cline are recorded in your file's Timeline, providing an easy way to track and revert modifications if needed.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="370" src="https://github.com/user-attachments/assets/bc2e85ba-dfeb-4fe6-9942-7cfc4703cbe5">

### Use the Browser

With Claude 3.5 Sonnet's new [Computer Use](https://www.anthropic.com/news/3-5-models-and-computer-use) capability, Cline can launch a browser, click elements, type text, and scroll, capturing screenshots and console logs at each step. This allows for interactive debugging, end-to-end testing, and even general web use! This gives him autonomy to fixing visual bugs and runtime issues without you needing to handhold and copy-pasting error logs yourself.

Try asking Cline to "test the app", and watch as he runs a command like `npm run dev`, launches your locally running dev server in a browser, and performs a series of tests to confirm that everything works. [See a demo here.](https://x.com/sdrzn/status/1850880547825823989)

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="350" src="https://github.com/user-attachments/assets/ac0efa14-5c1f-4c26-a42d-9d7c56f5fadd">

### "add a tool that..."

Thanks to the [Model Context Protocol](https://github.com/modelcontextprotocol), Cline can extend his capabilities through custom tools. While you can use [community-made servers](https://github.com/modelcontextprotocol/servers), Cline can instead create and install tools tailored to your specific workflow. Just ask Cline to "add a tool" and he will handle everything, from creating a new MCP server to installing it into the extension. These custom tools then become part of Cline's toolkit, ready to use in future tasks.

-   "add a tool that fetches Jira tickets": Retrieve ticket ACs and put Cline to work
-   "add a tool that manages AWS EC2s": Check server metrics and scale instances up or down
-   "add a tool that pulls the latest PagerDuty incidents": Fetch details and ask Cline to fix bugs

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="left" width="360" src="https://github.com/user-attachments/assets/7fdf41e6-281a-4b4b-ac19-020b838b6970">

### Add Context

**`@url`:** Paste in a URL for the extension to fetch and convert to markdown, useful when you want to give Cline the latest docs

**`@problems`:** Add workspace errors and warnings ('Problems' panel) for Cline to fix

**`@file`:** Adds a file's contents so you don't have to waste API requests approving read file (+ type to search files)

**`@folder`:** Adds folder's files all at once to speed up your workflow even more

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

<img align="right" width="350" src="https://github.com/user-attachments/assets/140c8606-d3bf-41b9-9a1f-4dbf0d4c90cb">

### Checkpoints: Compare and Restore

As Cline works through a task, the extension takes a snapshot of your workspace at each step. You can use the 'Compare' button to see a diff between the snapshot and your current workspace, and the 'Restore' button to roll back to that point.

For example, when working with a local web server, you can use 'Restore Workspace Only' to quickly test different versions of your app, then use 'Restore Task and Workspace' when you find the version you want to continue building from. This lets you safely explore different approaches without losing progress.

<!-- Transparent pixel to create line break after floating image -->

<img width="2000" height="0" src="https://github.com/user-attachments/assets/ee14e6f7-20b8-4391-9091-8e8e25561929"><br>

## 📚 文档导航

### 快速开始
- [什么是Cline?](docs/getting-started/what-is-cline.mdx) - 项目介绍和核心概念
- [安装指南](docs/getting-started/installing-cline.mdx) - 详细的安装步骤
- [新手指南](docs/getting-started/for-new-coders.mdx) - 编程新手的入门教程
- [模型选择指南](docs/getting-started/model-selection-guide.mdx) - 如何选择合适的AI模型

### 核心功能
- [项目架构概览](docs/project-overview.md) - 详细的技术架构文档
- [功能特性](docs/features/) - 所有功能的详细说明
- [MCP协议](docs/mcp/) - Model Context Protocol集成
- [提供商配置](docs/provider-config/) - 各AI提供商的配置方法

### 高级用法
- [提示工程指南](docs/prompting/) - 如何更好地与Cline交互
- [企业解决方案](docs/enterprise-solutions/) - 企业级部署和配置
- [故障排除](docs/troubleshooting/) - 常见问题解决方案

## Contributing

To contribute to the project, start with our [Contributing Guide](CONTRIBUTING.md) to learn the basics. You can also join our [Discord](https://discord.gg/cline) to chat with other contributors in the `#contributors` channel. If you're looking for full-time work, check out our open positions on our [careers page](https://cline.bot/join-us)!

## License

[Apache 2.0 © 2025 Cline Bot Inc.](./LICENSE)
