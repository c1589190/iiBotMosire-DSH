# @mosire/dsh-persona-mode

一个给 DeepSeek Harness（DSH）的**单角色扮演模式**：新增「标准人设扮演」预设，系统提示词只有两句，角色内容放在会话工作目录的 `PERSONA.md` 里，由 Host 插件在首轮和每次上下文压缩后注入。

> 这是 v0：只做「一个 preset + 首条注入 + 压缩重锚 + 缺文件门禁」。没有 UI 面板、没有多角色路由、没有工具白名单。

## 组成

| 文件 | 作用 |
|---|---|
| `cordis.patch.yml` | 插入 Host 插件行与 `preset-persona-standard` 预设声明 |
| `index.js` | Host 插件：`agent/pre-step` 注入、`qq_conversation_send` 门禁 |
| `lib/persona.js` | 纯函数：读文件、hash、构造消息、surface 检测 |
| `PERSONA.md.example` | 人设文件模板 |
| `test/persona.test.mjs` | `node:test` 单元测试 |

## 安装

把整个目录作为 bundle 安装：

```text
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/iiBotMosire-DSH/packages/dsh-persona-mode
```

安装会写入当前 profile，影响该 profile 的所有会话；需要 Full access 或审批。装完新开一个会话，模式选择器里会出现「标准人设扮演」。

## 使用

1. 在会话工作目录放 `PERSONA.md`（当前 QQ bot 的 cwd 是 `/home/cna/DevMosire-iiBot/bot`，即 `bot/PERSONA.md`）。
2. 新会话选择「标准人设扮演」。
3. 如果是 QQ bot，重新绑定 Inbox（preset 在会话创建时固定，旧会话换不了）。

系统提示词就是：

```text
你在扮演 <persona-contract> 定义的角色。在调用工具进行聊天发言时，请遵循 <persona-contract> 中的相关规则。
```

`dsh-persona` 配置为 `complete: true` + `includeRuntimeContext: false`，因此 DSH 不会在后面追加 “You are an AI agent…” 或工具指引。工具 schema 仍然照常下发。

## 工具面

预设挂载 Minimal 工具组：

| 工具 | 用途 |
|---|---|
| `read` | 读 `PERSONA.md`、笔记、文本文件 |
| `read_image` | 读图片（QQ 消息带图时） |
| `bash` | persistent shell，执行命令 |
| `subagent_custom` | 父 Agent 自定义子 Agent 的 system prompt，一次性 spawn |

`write`/`edit` 关闭；`qq_*`、`inbox_*` 仍由宿主 MCP/插件提供。没有通用 `subagent`；自定义子 Agent 走 `subagent_custom`。也没有 `todo`、`ask_user`、`workflow`、`plugin-manager`、`schedule`、`present`。

## 自定义子 Agent（subagent_custom）

两层分工：

- **系统提示词**：`system_prompt` 可选。省略时就是极简模式同款
  `You are a helpful software engineer assistant.`；由 `custom-persona` 以
  `complete: true` + `interpolate: false` 注入，所以提示里带 `{{...}}` 也不会炸。
- **第一条 user**：`prompt` 必填，会成为子 Agent 的第一条 user 消息。角色、任务、
  必要上下文、输出格式都写进去；子 Agent 看不到当前对话。

推荐：一次性任务省略 `system_prompt`，把角色写进 `prompt`：

```json
{
  "prompt": "你是规则检索员。任务：在 wenyu/rules 中查找夜袭判定。上下文：群 1104560326 当前回合。输出：三条原文引用 + 一句结论。",
  "description": "rules lookup"
}
```

需要固定长期身份时再给 `system_prompt`：

```json
{
  "prompt": "按规则判定这次行动是否成功。",
  "system_prompt": "你是时代文游的规则裁判。只输出判定、依据和代价，不扮演角色。",
  "description": "rules judge"
}
```

- 子 Agent **只挂三个工具**：`read`、`read_image`、`bash`。`custom-restrict` 用空 allow 表隐藏所有宿主工具（`qq_*`、`inbox_*`、搜索、上下文插件等），所以目录里看不到它们，也省 token。
- 没有 `write`/`edit`；但 shell 仍可写文件。
- 子 Agent 不挂 `agent-instructions`，所以不会读到 `bot/AGENTS.md` 里的旧 OpenCode 规则。
- 子 Agent 不能调用 `qq_*`/`inbox_*`：`custom-restrict` 隐藏，`custom-guard` + Host guard 再兜底拒绝。
- 每次调用会动态注册一个一次性 preset，子 Agent 发布后立即注销；**活着的子 Agent 不受影响，但重启后不能冷恢复**。需要可恢复的子 Agent，用静态 preset + 普通 `subagent`。
- 子 Agent 的最终答复作为完成通知回到父 Agent；发不发到群里由父 Agent 决定。
- 每条子 Agent 是一条独立模型循环，只在重活时用。

## 行为

| 情况 | 行为 |
|---|---|
| 首轮请求 | 在 wake/用户消息之前注入 `<persona-contract>` |
| 上下文压缩 | surface 上找不到契约 → 自动重注 |
| 修改 `PERSONA.md` | hash 变化 → 下一轮注入新版，并声明“以本条为准” |
| resume 且契约还在 surface | 跳过，不重复 |
| 文件缺失/为空 | 注入操作者提示；`qq_conversation_send` 被 guard 拦截 |
| 非本 preset 的会话 | 完全不介入 |

注入是模型侧 user 消息，**不会发到 QQ**；外发仍然只有 `qq_conversation_send`。

## 限制

- **预设挂的是 Minimal 工具组**：`read`/`read_image` + persistent `bash`；`write`/`edit` 关闭。`qq_*` 是 Host MCP，必须保留；profile 里其他插件注册的工具仍可能出现。要硬隔离，用独立 profile，或后续加 `tools.restrict` / 工具白名单。
- **shell 能写文件**：`write`/`edit` 关闭只是 fs 工具层的限制，persistent bash 仍可写。要真正的只读，去掉 `persistent-shell`，只留 `tool-fs` 的 `read`。
- 没有 UI、没有多角色、没有 `PERSONA.md` 的 frontmatter 解析。
- `complete: true` 会压掉 DSH 内置的 harness identity 与工具指引，这是有意的；工具用法由系统提示和人设自行约束。
- 已有会话保留创建时的 preset；改 preset 后必须新开会话验证。

## 验证

已跑：

- `node --check`（index、custom-subagent、custom-guard、custom-persona、custom-restrict、lib）
- `node --test`：24 tests / 24 pass
- `cordis.patch.yml` YAML 解析
- `plugin_manager install_bundle` / `set_bundle`：`application: applied`
- `dsh --profile web --dump-config`：预设里已有 `tool-custom-subagent`

未跑（`NOT_RUN`）：

- **DSH 重启**：`plugin_manager` 对新增 JS 模块报 `restart-required` / `unmanaged-plugin`，需要重启一次才能加载 `custom-subagent` / `custom-persona` / `custom-guard`
- 在 Web UI 新会话中选择该 preset
- `subagent_custom` 首次实跑（动态 preset 注册 + spawn + 完成通知）
- 真实 QQ wake → 注入 → 回复 → ack 闭环
- 压缩后重注的实机验证
