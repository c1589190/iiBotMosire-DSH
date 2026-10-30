# iiBotMosire-DSH

iiBot 专属的 DeepSeek Harness（DSH）插件。通用 Inbox 适配器留在
[`InboxMosire-DSH`](https://github.com/c1589190/InboxMosire-DSH)；这里只放依赖
iiBot 业务语义的东西。

## 包

| 包 | 作用 |
|---|---|
| [`packages/dsh-persona-mode`](packages/dsh-persona-mode) | 「标准人设扮演」预设：首条消息注入 `PERSONA.md`、压缩后重锚、缺文件拦截外发、`subagent_custom` 一次性子 Agent |
| [`packages/dsh-iibot-wake-profile`](packages/dsh-iibot-wake-profile) | **legacy 零语义 alias**：只为现有 `wakeProfile=iibot` 配置保留名称解析；不包含工具名、业务 kind 或流程文案 |

## 依赖方向

```text
InboxMosire-DSH (generic wake adapter, >= 0.7.0)
        ▲
        │ generic view-ack (wakeProfile optional legacy alias)
iiBotMosire-DSH (this repo)
        │
        ▼
iiBotMosire (QQ bot + qq_* MCP)
```

- 本仓不复制 Inbox 适配器实现，只消费它的 `inboxWakeProfiles` 服务和
  `wakeProfile` 配置；通用 view-ack 已不依赖程序 profile。
- 本仓不修改 `iiBotMosire` Java 源码；`qq_*` 工具由 Bot MCP 提供。
- 人设与 DSH 专属体验留在本仓；业务工具名、read/send/ack 流程和
  `digest_complete` 语义只由 iiBot MCP 自己描述。wake-profile 包只做迁移期
  名称兼容，不再承载 QQ 业务语义。

## 安装顺序

新安装：

```text
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/InboxMosire-DSH
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/iiBotMosire-DSH/packages/dsh-persona-mode
```

只有仍保留 `wakeProfile=iibot` 的旧配置才额外安装：

```text
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/iiBotMosire-DSH/packages/dsh-iibot-wake-profile
```

装完重启 DSH。新增 JS 模块不能热加载。新配置应使用 generic profile；
`wakeProfile` 未注册时通用适配器也会回退 generic。

## 测试

每个包独立：

```bash
cd packages/dsh-persona-mode && node --test
cd packages/dsh-iibot-wake-profile && node --test
```

## 边界

- 不把 raw token、Bearer、完整 QQ 正文写进仓库、日志或测试。
- 人设文件 `PERSONA.md` 由操作者写，Bot 只读；记忆走 `qq_user_note_*`。
- 子 Agent 不允许调用 `qq_*` / `inbox_*`；发言和 ack 只由顶层会话执行。
