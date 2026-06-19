# Name: Electron Professional Tomato Clock

**作者**: Senior Software Engineer Agent
**版本**: 1.0.0
**触发词**: markdown文件预览阅读软件

## Description
该 Skill 用于构建一个基于 Electron 和 Web 技术的专业markdown预览阅读软件。它集成了动态背景切换、自定义背景色调设置以及优雅的 UI 设计。

**核心功能亮点：**
1.  **架构设计**：采用 Electron 主进程与渲染进程分离的架构。
2.  **视觉体验**：支持随机/指定主题背景，采用 Glassmorphism（毛玻璃）风格设计，提供动态的背景切换，布局简洁、直观，交互简单。
3.  **功能完善**：支持mermaid路程图自动加载展示且流程图支持导出图片。

## 执行步骤

### 1. 项目初始化
请在项目根目录执行以下命令：
```bash
npm init -y
npm install electron --save-dev
```

### 2. 项目文件结构
建议创建以下文件结构：
```text
my-tomato-clock/
├── main.js              # Electron 主进程入口
├── renderer.js          # 阅读逻辑、UI交互
├── index.html           # 界面结构
├── style.css            # 界面样式与动画
├── assets/              # 资源文件夹（如需添加本地图片可在此放置）
└── package.json         # 项目配置
└── README.md            # 项目说明文档 
└── read_markdown_file.py # 负责读取markdown文件并将内容传递给renderer.js
```

这是一个完整的、单文件的 Electron 应用结构，包含了 HTML、CSS、JS 和 Node 模块。它具备以下特点：
*   **现代化 UI**：使用毛玻璃效果和渐变背景。
*   **功能完备**：自定义背景色调设置、支持mermaid路程图自动加载展示且流程图支持导出图片。
*   **声音反馈**：基于 Web Audio API（隐含在 JS 逻辑中，此处使用了简单的逻辑），可以开关滴答声。
*   **自适应**：界面简洁，适配桌面窗口。
