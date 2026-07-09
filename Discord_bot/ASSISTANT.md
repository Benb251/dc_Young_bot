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

Assistant onboarding:

- `ASSISTANT_WELCOME_ENABLED`, default `false`; set `true` to enable the new member workflow.
- `ASSISTANT_WELCOME_CHANNEL_ID`, optional channel ID for public welcome embeds.
- `ASSISTANT_WELCOME_DM`, default `false`; set `true` to DM new members.
- `ASSISTANT_WELCOME_ROLE_ID`, optional role ID to auto-assign on join.
- `ASSISTANT_RULES_CHANNEL_ID`, optional rules channel linked in the welcome embed.
- `ASSISTANT_INTRO_CHANNEL_ID`, optional introduction channel linked in the welcome embed.
- `ASSISTANT_HELP_CHANNEL_ID`, optional help/Q&A channel linked in the welcome embed.
- `ASSISTANT_WELCOME_TITLE`, `ASSISTANT_WELCOME_MESSAGE`, and `ASSISTANT_WELCOME_DM_MESSAGE` support `{user}`, `{username}`, `{server}`, and `{memberCount}`.

Assistant web fetch:

- `ASSISTANT_WEB_TIMEOUT_MS`, default `15000`, max `60000`.
- `ASSISTANT_WEB_MAX_BYTES`, default `512000`, max `2000000`.
- `ASSISTANT_WEB_IMAGE_LIMIT`, default `8`.
- Public `http/https` pages only. Localhost and private network IPs are blocked.
- HTML extraction prefers main/article content and strips common sidebar/navigation/table-of-contents blocks.
- Article images are attached as section embeds near their original position, so Discord displays the image with the relevant text/caption without exposing raw image URLs.
- X/Twitter status URLs are handled through the public oEmbed endpoint when available. Private/deleted/restricted posts may still be unreadable.

Assistant moderation:

- `ASSISTANT_WARNING_FILE`, default `Discord_bot/data/assistant_warnings.json`
- `ASSISTANT_MAX_WARNINGS`, default `1000`

Assistant safety / risk tiers:

- `ASSISTANT_CONFIRM_TTL_MS`, default `60000`
- `ASSISTANT_AUDIT_CHANNEL_ID`, optional channel ID where assistant action audits are sent
- `ASSISTANT_AUTO_WRITE`, default `true`. When `true`, **write** actions run immediately for admins. When `false`, write actions also require confirmation. **critical** actions always require confirmation.
- `ASSISTANT_MAX_ACTIONS`, default `10` (max `20`) — max tool actions per model turn.

### Risk tiers

| Tier | Behavior | Examples |
|------|----------|----------|
| `safe` | Execute immediately | list/inspect/diagnose/fetch/status |
| `write` | Execute immediately if `ASSISTANT_AUTO_WRITE=true` | send_message, create_channel, assign_role, pin, panels |
| `critical` | Always stage → admin replies `xác nhận` / `hủy` | delete_channel, ban/kick/unban, set_channel_permissions, edit_role, bulk_lock, delete_messages, publish_url_to_forum |

If a batch contains any critical action, the **entire batch** is staged for confirmation.

### Re-invite bot (Discord permissions)

`diagnose_permissions` prints an OAuth invite URL with recommended bot permissions:

ViewChannel, SendMessages, ReadMessageHistory, EmbedLinks, AttachFiles, AddReactions, UseExternalEmojis, ManageMessages, ManageChannels, ManageRoles, ManageThreads, CreatePublicThreads, CreatePrivateThreads, ManageNicknames, KickMembers, BanMembers, ModerateMembers.

After re-invite: place the bot role **above** any role it must assign/edit.

See also `TOOL_GAP_CHECKLIST.md` for remaining gaps vs one-shot setup scripts.

`Discord_bot/data/` is ignored by git because it may contain private server memory.

## How It Works

- Normal members can mention the bot to ask questions naturally.
- The owner can DM the bot with natural language commands.
- Admins can mention the bot in-server and ask it to perform supported admin actions.
- The assistant asks the model for a JSON decision, executes allowed tools by risk tier, then reports the result.
- AI calls use the primary model first, then fallback models if configured, with bounded timeout and retry handling.
- Critical (and write when auto-write is off) actions are staged **once**. Confirm options (requesting admin only):
  1. **React ✅** = xác nhận, **❌** = hủy (most reliable on the gateway bot)
  2. Buttons (secondary; raw REST ack)
  3. Type `xác nhận` / `hủy`
  TTL defaults to 60s (`ASSISTANT_CONFIRM_TTL_MS`).
- After useful turns, the assistant can extract durable facts into memory while filtering secrets and low-confidence guesses.
- Reminders are persisted to disk and delivered from the gateway loop, so pending reminders survive a container restart.
- When enabled, onboarding can welcome new members, DM them, and assign one starter role through `guildMemberAdd`.
- Every assistant tool decision is written to console audit logs, and optionally to `ASSISTANT_AUDIT_CHANNEL_ID`.
- `assistant_status` reports runtime, AI model chain, store health, and memory/reminder/warning counts.
- `analyze_server` lets admins ask for a practical operations roadmap based on the visible server structure and open task backlog.
- `learn_server` stores an updatable guild memory profile from the visible server structure, so future chats can reuse server context.

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
- `learn_server`: generate and upsert a persistent guild memory profile for the current server.
- `inspect_member`: inspect one member's roles, notable permissions, join/account age, timeout state, and active warnings.
- `fetch_url` / `summarize_url`: fetch a public web page and summarize or reshape it for Discord/resource-hub use.
- `publish_url_to_forum`: turn a public web page into a Vietnamese Discord resource post/thread with source link and image URLs from the original page. Supports faithful translation mode when `exact=true` or the admin asks for exact/full translation. This is a server-changing action and requires confirmation.
  If a Discord forum requires a tag and no requested tag matches, the assistant uses the forum's first available tag.
- `search_messages`: search recent visible chat messages by keyword in one channel or across visible channels.
- `schedule_reminder`: schedule a future reminder in the current channel or DM.
- `list_reminders`: list pending reminders for the current admin/user.
- `cancel_reminder`: cancel a pending reminder by ID prefix.
- `create_task`: create a persistent server/user/channel todo item.
- `list_tasks`: list open, done, cancelled, or all tasks.
- `complete_task` / `cancel_task`: update a task by ID prefix.
- `create_text_channel`: create a text channel, optionally under a category.
- `create_category`: create a channel category.
- `create_forum_channel`: create a forum channel with optional tags and parent category.
- `move_channel`: move a channel into a category (or root with `category: none`).
- `delete_channel`: delete a channel/category (**critical**). Non-empty categories refuse unless handled carefully.
- `set_channel_permissions`: set allow/deny overwrites for @everyone, a role, or member (**critical**). `clear=true` removes overwrite.
- `create_thread`: create a thread in a text/announcement channel or a post in a forum channel.
- `rename_channel`: rename a channel.
- `set_channel_topic`: update a text channel topic.
- `set_slowmode`: set or clear channel slowmode.
- `lock_channel` / `unlock_channel`: deny or restore `@everyone` send permission in a channel.
- `bulk_lock_channels`: lock many channels in one confirmable action (**critical**).
- `pin_message` / `unpin_message`: pin or unpin a referenced message, message URL, or message ID.
- `edit_message`: edit a **bot-authored** message by reply/URL/id (Discord only allows editing own messages).
- `delete_message`: delete **one** message (bot's own or any member's) via reply, full message link, or id. Needs Manage Messages for others' messages. Prefer reply-to-target. Not for whole forum posts.
- `delete_messages`: purge recent messages in a channel (`count` 1–100). Optional `member` to purge one user, or `onlyBot: true` for bot messages only. **critical**.
- `delete_thread`: delete a forum post / thread by name, link, id, or current thread (**critical**). Needs Manage Threads / Manage Channels.
- `rename_thread` / `archive_thread` / `unarchive_thread` / `lock_thread` / `unlock_thread`: manage threads.
- `set_thread_tags`: apply forum tags to a thread.
- `list_threads`: list active/archived threads in a channel.
- `mark_thread_solved`: swap Q&A forum tags to "Đã giải quyết".
- `assign_role` / `remove_role`: manage member roles by mention, ID, or name (hierarchy checked).
- `create_role`: create a new role.
- `edit_role`: rename/color/hoist/mentionable/permissions for a role (**critical**).
- `timeout_member` / `remove_timeout`: timeout or clear timeout.
- `set_nickname`: set or clear a member nickname.
- `dm_member`: DM a member (soft-fail if closed DMs).
- `warn_member`: record a moderation warning and optionally DM the member.
- `list_warnings`: list active warnings, optionally for one member.
- `clear_warning`: clear an active warning by ID prefix.
- `kick_member` / `ban_member` / `unban_member`: moderation removals (**critical** for ban/kick/unban).
- `list_bans`: list banned users.
- `send_roles_panel` / `send_visa_panel` / `send_rules_panel`: post community panels (buttons use same custom_ids as cf-bot; gateway handles clicks when this bot sent the message).
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
