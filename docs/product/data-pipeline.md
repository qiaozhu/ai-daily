# 数据采集与日报 JSON

## 采集（X 工具，命名空间 `x`）
统一参数：`post.fields=public_metrics,created_at,author_id`，`expansions=author_id`，`user.fields=username,name`。时间窗约最近 24 小时（`start_time` 用 UTC；官方账号可放宽到约 36 小时）。

1. `search_news`：`artificial intelligence AI`（`max_age_hours` 36，`max_results` 25）——当天话题清单。
2. `search_news`：`open source AI model DeepSeek Qwen Kimi China`；`NVIDIA AI chips data center`（各 15 条）。
3. `search_posts_all` 官方账号（`sort_order: recency`）：
   - `(from:OpenAI OR from:AnthropicAI OR from:GoogleDeepMind OR from:sama OR from:xai OR from:GeminiApp OR from:demishassabis OR from:OpenAIDevs OR from:claudeai OR from:grok) -is:retweet -is:reply`
   - `(from:deepseek_ai OR from:Alibaba_Qwen OR from:Kimi_Moonshot OR from:MistralAI OR from:AIatMeta OR from:huggingface OR from:Zai_org OR from:MiniMax__AI OR from:StepFun_ai OR from:nvidia OR from:karpathy OR from:GoogleAI OR from:Google) -is:retweet -is:reply`
   - `from:elonmusk (AI OR Grok OR xAI OR intelligence) -is:retweet`
4. 中文圈：`(AI OR 大模型 OR 人工智能 OR OpenAI OR Claude OR DeepSeek OR 千问) lang:zh -is:retweet -is:reply`（relevancy）。
5. 针对 1–2 步的新闻话题，各 1 次 `search_posts_all`（relevancy，20 条）找代表帖。

注意：不支持 `min_faves`/`min_retweets`；relevancy 排序会混入低互动帖和广告，需按互动数挑选。帖子链接格式 `https://x.com/<username>/status/<id>`，发帖时间可由 ID 精确换算：`ms = (id >> 22) + 1288834974657`。

## JSON 结构（`$DATA_DIR/YYYY-MM-DD.json`，模板见 `tools/day_template.json`）
- 顶层：`date`、`generated_at`（带 `+08:00`）、`timezone`、`source`、`highlights[]`、`stories[]`、`data_quality_notes[]`。
- story：`id`（稳定，`YYYY-MM-DD-slug`，收藏靠它）、`headline_zh`、`summary_zh`、`why_it_matters`、`org_tag`、`categories[]`、`topics[]`、`heat`、`source_posts[]`、`news_refs[]`、`data_quality`。数组顺序 = 排名。
- post：`handle`、`post_id`、`url`（必须 x.com）、`text`、`lang`、`translation_zh`、`likes`、`reposts`、`replies`、`views`（可选 `name`，目前未入库）。
- `categories` 固定集合：大模型、开源、产品、芯片、政策、融资、中文圈、安全、科研、就业（尽量复用，保证趋势可比）。`topics` 用稳定实体名（OpenAI、Anthropic、DeepSeek…）。

`scripts/json2sql.js` 会校验：date 格式且与文件名一致、stories 非空、必填字段、id 不重复、url 为 x.com。
> 注：`highlights`（今日要点）仍存储并随 API 返回，v3 起前端不再展示。
