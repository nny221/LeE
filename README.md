# LeE

一个轻量的跨平台英语生词复习桌宠。

## 当前功能

- 常驻桌面的透明桌宠和系统托盘
- 手动录入、浏览和删除生词
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

## 后续功能

- 多模态模型录入
- 单词导入与导出
- 学习统计
- 开机启动和提醒时段设置
