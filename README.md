# LeE

一个轻量的跨平台英语生词复习桌宠。

## 当前功能

- 常驻桌面的透明桌宠和系统托盘
- 手动录入、浏览和删除生词
- 从文字片段、剪贴板截图或本地图片批量导入
- 自动排除高频基本词，并识别值得学习的单词和词组
- 为每个词保留原文语境句、整句翻译、释义和音标
- 导入时对当前批次和现有词库进行去重
- 在复习窗口中先回忆，再揭示释义
- 使用“对 / 半对 / 错”记录熟悉、模糊和忘记
- SQLite 本地持久化
- 基于复习结果计算下次出现时间

## 技术栈

- Electron
- TypeScript
- React
- electron-vite
- SQLite / Node.js `node:sqlite`

## 开发

```bash
npm install
npm run dev
```

## 检查与构建

```bash
npm test
npm run build
npm run package
```

用户数据保存在 Electron 的 `userData` 目录中，数据库文件名为 `lee.db`。

## 模型导入

在词库窗口点击“从截图或文字导入”，然后配置兼容 Chat Completions 的
Base URL、模型名称和 API Key。模型需要支持图片输入和合法 JSON 输出。

处理流程：

```text
文字/截图
  → 图片转写（仅截图）
  → 本地分词、词形还原和基本词过滤
  → 模型识别词组
  → 本地去重
  → 模型分批补全释义和语境句翻译
  → SQLite 事务写入
```

截图入口使用系统截图后读取剪贴板，也可以直接选择本地图片。API Key
会通过 Electron `safeStorage` 加密保存。开发时也可以用环境变量覆盖：

```bash
LEE_MODEL_BASE_URL=https://api.openai.com/v1
LEE_MODEL_NAME=your-model-name
LEE_MODEL_API_KEY=your-api-key
```

基本词默认使用最高频的 3500 个英语词形及其词元，并排除代词、限定词、
介词、连词、专有名词和标点。词组由模型识别后，再通过原文存在性校验。

## 后续功能

- 多模态模型录入
- 单词导入与导出
- 学习统计
- 开机启动和提醒时段设置
