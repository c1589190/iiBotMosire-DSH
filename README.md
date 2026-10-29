# iiBotMosire-DSH

iiBot 专属的 DeepSeek Harness（DSH）插件。通用 Inbox 适配器留在
[`InboxMosire-DSH`](https://github.com/c1589190/InboxMosire-DSH)；这里只放依赖
iiBot 业务语义的东西。

## 包

| 包 | 作用 |
|---|---|
| [`packages/dsh-persona-mode`](packages/dsh-persona-mode) | 「标准人设扮演」预设：首条消息注入 `PERSONA.md`、压缩后重锚、缺文件拦截外发、`subagent_custom` 一次性子 Agent |
| [`packages/dsh-iibot-wake-profile`](packages/dsh-iibot-wake-profile) | 给 `@mosire/dsh-inbox-mosire` 注册 `iibot` 唤醒 profile：`qq_conversation_read/ack` 工具名 + 中文 view-ack 正文 |

## 依赖方向

```text
InboxMosire-DSH (generic wake adapter, >= 0.5.0)
        ▲
        │ inboxWakeProfiles / wakeProfile: iibot
iiBotMosire-DSH (this repo)
        │
        ▼
iiBotMosire (QQ bot + qq_* MCP)
```

- 本仓不复制 Inbox 适配器实现，只消费它的 `inboxWakeProfiles` 服务和
  `wakeProfile` 配置。
- 本仓不修改 `iiBotMosire` Java 源码；`qq_*` 工具由 Bot MCP 提供。
- 人设内容、唤醒正文、工具名都留在这里；通用适配器保持 agent/program 无关。

## 安装顺序

```text
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/InboxMosire-DSH
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/iiBotMosire-DSH/packages/dsh-iibot-wake-profile
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/iiBotMosire-DSH/packages/dsh-persona-mode
```

装完重启 DSH。新增 JS 模块不能热加载。

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
