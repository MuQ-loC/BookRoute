# AI Setup

BookRoute is AI-first. Local parsing is only a failure state.

## DeepSeek

Create `.env`:

```powershell
Copy-Item .env.example .env
```

Set:

```text
DEEPSEEK_API_KEY=your_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

Start:

```powershell
npm run server
npm run dev
```

## Other OpenAI-Compatible Providers

Use:

```text
BOOKROUTE_LLM_API_KEY=your_key
BOOKROUTE_LLM_BASE_URL=https://your-provider-base-url
BOOKROUTE_LLM_MODEL=your-model
```

The endpoint must support:

```text
POST /chat/completions
response_format: { "type": "json_object" }
```

## What AI Does

AI returns:

- standard title
- author
- publisher
- year
- ISBN candidate
- edition / translator notes
- confidence
- reason
- piracy risk flag

AI must not return:

- netdisk links
- extraction codes
- pirated PDFs
- official-platform bypasses
- automatic transfer targets for suspected infringing files
