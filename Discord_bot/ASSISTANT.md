# Advanced Assistant Brain

`bot_gateway.js` now routes owner DMs and bot mentions through an agent-style assistant brain.

## Environment

Required for Discord:

- `DISCORD_TOKEN`
- `GUILD_ID`
- `ADMIN_DISCORD_ID`

AI provider, compatible with 9router/OpenAI-style chat completions:

- `AI_ENDPOINT`, default `http://localhost:20128/v1`
- `AI_API_KEY`, optional bearer token
- `AI_MODEL`, default `xai/grok-4`
- `AI_MODEL_FALLBACKS`, optional comma-separated fallback models, for example `openai/gpt-5.5,xai/grok-4`
- `AI_TIMEOUT_MS`, default `60000`
- `AI_MAX_RETRIES`, default `1`
- `AI_SYSTEM_PROMPT`, optional base system prompt used by `ai_helper.js`

Assistant memory:

- `ASSISTANT_MEMORY_FILE`, default `Discord_bot/data/assistant_memory.json`
- `ASSISTANT_MAX_FACTS`, default `500`
- `ASSISTANT_CONVERSATION_TURNS`, default `16`
- `ASSISTANT_AUTO_MEMORY`, default `true`; set `false` to disable model-assisted memory extraction
- `ASSISTANT_AUTO_MEMORY_LIMIT`, default `3`

Assistant reminders:

- `ASSISTANT_REMINDER_FILE`, default `Discord_bot/data/assistant_reminders.json`
- `ASSISTANT_REMINDER_POLL_MS`, default `30000`
- `ASSISTANT_MAX_REMINDERS`, default `500`

Assistant tasks:

- `ASSISTANT_TASK_FILE`, default `Discord_bot/data/assistant_tasks.json`
- `ASSISTANT_MAX_TASKS`, default `500`

Assistant moderation:

- `ASSISTANT_WARNING_FILE`, default `Discord_bot/data/assistant_warnings.json`
- `ASSISTANT_MAX_WARNINGS`, default `1000`

Assistant safety:

- `ASSISTANT_CONFIRM_TTL_MS`, default `60000`
- `ASSISTANT_AUDIT_CHANNEL_ID`, optional channel ID where assistant action audits are sent

`Discord_bot/data/` is ignored by git because it may contain private server memory.

## How It Works

- Normal members can mention the bot to ask questions naturally.
- The owner can DM the bot with natural language commands.
- Admins can mention the bot in-server and ask it to perform supported admin actions.
- The assistant asks the model for a JSON decision, executes allowed low-risk tools, then reports the result.
- AI calls use the primary model first, then fallback models if configured, with bounded timeout and retry handling.
- Server-changing actions are staged first. Reply with `xác nhận` within the TTL to run them, or `hủy` to cancel.
- After useful turns, the assistant can extract durable facts into memory while filtering secrets and low-confidence guesses.
- Reminders are persisted to disk and delivered from the gateway loop, so pending reminders survive a container restart.
- Every assistant tool decision is written to console audit logs, and optionally to `ASSISTANT_AUDIT_CHANNEL_ID`.
- `assistant_status` reports runtime, AI model chain, store health, and memory/reminder/warning counts.
- `analyze_server` lets admins ask for a practical operations roadmap based on the visible server structure and open task backlog.

## Supported Tools

- `send_message`: send a message to a named channel or channel ID.
- `send_embed`: send a styled Discord embed announcement with title, description, fields, color, images, and footer.
- `assistant_status`: report bot uptime, model routing, cache counts, and assistant store health.
- `summarize_channel`: summarize recent messages from a channel.
- `delete_messages`: delete recent messages in the current channel.
- `list_channels`: list visible text/forum channels.
- `diagnose_permissions`: report missing server/channel permissions, role hierarchy limits, and an invite URL with recommended permissions.
- `inspect_server`: read a server map with channel, category, role, member, and owner metadata.
- `analyze_server`: analyze the current server structure and suggest the next operations phase, with an offline fallback if AI routing fails.
- `inspect_member`: inspect one member's roles, notable permissions, join/account age, timeout state, and active warnings.
- `search_messages`: search recent visible chat messages by keyword in one channel or across visible channels.
- `schedule_reminder`: schedule a future reminder in the current channel or DM.
- `list_reminders`: list pending reminders for the current admin/user.
- `cancel_reminder`: cancel a pending reminder by ID prefix.
- `create_task`: create a persistent server/user/channel todo item.
- `list_tasks`: list open, done, cancelled, or all tasks.
- `complete_task` / `cancel_task`: update a task by ID prefix.
- `create_text_channel`: create a text channel, optionally under a category.
- `create_thread`: create a thread in a text/announcement channel or a post in a forum channel.
- `rename_channel`: rename a channel.
- `set_channel_topic`: update a text channel topic.
- `set_slowmode`: set or clear channel slowmode.
- `lock_channel` / `unlock_channel`: deny or restore `@everyone` send permission in a channel.
- `pin_message` / `unpin_message`: pin or unpin a referenced message, message URL, or message ID.
- `rename_thread` / `archive_thread`: manage the current or named thread.
- `assign_role` / `remove_role`: manage member roles by mention, ID, or name.
- `create_role`: create a new role.
- `timeout_member`: timeout a member for a bounded number of minutes.
- `warn_member`: record a moderation warning and optionally DM the member.
- `list_warnings`: list active warnings, optionally for one member.
- `clear_warning`: clear an active warning by ID prefix.
- `kick_member` / `ban_member`: remove abusive members when clearly requested by an admin.
- `remember`: store a scoped memory fact.
- `recall_memory`: search stored memory.
- `list_memory`: list visible memory facts with short IDs.
- `forget_memory`: delete a visible memory fact by ID prefix or a unique query match.

Admin tools are guarded by `ADMIN_DISCORD_ID` or Discord Administrator permission. Non-admin users can chat and use memory-style interactions, but cannot execute server actions.

## Verification

```bash
npm test
```

The smoke test validates assistant JSON parsing and local memory without connecting to Discord or the AI provider.
