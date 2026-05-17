# BookRoute

Legal book discovery and acquisition route assistant.

BookRoute takes a natural-language book request and returns legal routes:

- Open Library bibliographic search
- WorldCat library holdings
- Google Books previews and publisher metadata
- Gutendex / Project Gutenberg public-domain route
- DOAB open-access academic books
- Manual purchase search for authorized new or used copies
- GitHub / CSDN public search routes for book notes, examples, edition clues, and legal public references

It does not return pirated netdisk links, extraction codes, unofficial PDF mirrors, or automatic transfer workflows for suspected infringing files.

## Why This Exists

Many people do not actually need piracy. They need a low-friction path to:

- find the exact book edition
- compare legal acquisition options
- find a library copy
- find public-domain or open-access alternatives
- buy a cheaper used authorized copy
- keep a personal reading procurement workflow organized

This project turns that into a small public tool that can be shown on GitHub and sold as a service to students, reading groups, small libraries, schools, researchers, and personal knowledge-base users.

## Features

- AI-first natural-language book disambiguation
- Cloud LLM or local Ollama Qwen bridge for title / author / publisher / year / ISBN / edition candidates
- Built-in piracy-intent blocker
- Open Library API search
- Legal route cards
- Manual purchase route generation
- Configured target-site matrix for legal public search entry points
- Clean React + Vite frontend
- Tiny local Node AI bridge

## Quick Start

```powershell
cd D:\CODE\BookRoute
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

AI bridge:

```powershell
Copy-Item .env.example .env
# edit .env and set DEEPSEEK_API_KEY
npm run server
```

The bridge tries cloud LLM first if configured, then local Ollama Qwen. Local string parsing is only a failure mode.

## Legal Boundary

BookRoute is designed as a lawful discovery and acquisition assistant.

The project does not:

- search for pirated book files
- return Baidu Netdisk / Aliyun Drive / Quark Drive piracy links
- return extraction codes
- bypass platform rules
- automate purchases without explicit human confirmation
- transfer suspected infringing files into a personal netdisk
- crawl GitHub / CSDN content in bulk or bypass login, paywalls, robots, or platform limits

The AI bridge prompt explicitly blocks piracy-oriented output.

## First Cash Service

Service name:

```text
合法找书 / 资料获取路线整理
```

Customer gives:

- book title / ISBN / author
- edition requirements
- budget
- deadline
- whether library / used book / open-access alternatives are acceptable

You deliver:

- exact edition candidates
- legal purchase links or search routes
- library / public-domain / OA routes
- cheaper used-copy options
- final recommendation

Starter pricing:

| Service | Price |
| --- | ---: |
| 1 book legal route | 9.9-29 RMB |
| 10-book reading list sourcing | 99-299 RMB |
| course / research bibliography route pack | 299-999 RMB |
| school / reading group acquisition workflow | 1999+ RMB |

## Architecture

```text
User query
  -> React frontend
  -> local AI bridge
  -> cloud LLM or Ollama qwen2.5:3b
  -> AI book candidates with author / publisher / year / ISBN / confidence
  -> user selects exact candidate
  -> piracy intent check
  -> Open Library / public legal routes
  -> GitHub / CSDN public search entry points
  -> route cards
  -> manual purchase / borrowing action
```

## Environment

```text
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-chat
PORT=8787
```

## Source Notes

- Open Library Search API: https://openlibrary.org/dev/docs/api/search
- Gutendex API: https://gutendex.com/
- DeepSeek API docs: https://api-docs.deepseek.com/
