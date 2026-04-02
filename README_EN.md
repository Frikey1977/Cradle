# Cradle - Enterprise AI Assistant Platform

> [中文版](./README.md)

## Project Overview

Cradle is an **enterprise-grade, privately deployable AI assistant platform** designed to provide one-on-one Agents for every employee. It helps complete work tasks, align work objectives, and沉淀岗位工作逻辑, ultimately forming an enterprise's digital employee assets.

### Core Features

**Native Internationalization & Cross-language Support**
- Built-in multi-language system, suitable for organizations with diverse language backgrounds

**Cradle Web Visual Management**
- Agent memory is editable and trimmable
- Agent Skills can be configured and managed visually based on job requirements
- Agent workflow is visualized and trackable, with Token consumption clearly visible
- Agents can interact with multiple users with isolated conversation memory
- Independent heartbeat management with configurable frequency and work content for different scenarios
- Powerful context management with predefined contexts saving up to 90% Token consumption

**Triple Profile System** enables Agents to clearly understand who they are, who the other party is, and the relationship between them for appropriate responses
- **User Profile**: Including but not limited to internal employees, customers, suppliers, strangers
- **Agent Profile**: Including but not limited to company, department, job responsibilities, and organizational culture at all levels
- **Relationship Profile**: The relationship between user and Agent, progressively maintained by LLM extracting information from conversations

**Six-layer Memory System** allows Agents to remember conversations with different users
- **Agent Profile**: Self-awareness enabling LLM to precisely handle corresponding work tasks
- **Short-term Memory**: Recent interactive conversation content (semantic and information density distillation for conversations beyond 20 rounds to save context)
- **Memory Index**: Semantic-based memory index, vectorized by conversation topic, saved to vector database with metadata pointing to long-term memory physical files
- **Long-term Memory**: Distilled conversations stored as long-term memory by date, with metadata pointing to original conversations
- **Original Conversations**: All original content saved daily in Log format for auditing and migration
- **Collective Subconscious**: Best practices from Agent execution can be extracted and diffused to other Agents, automatically loaded by memory manager
- **Job Skill Best Practices**: Aggregated and refined from historical tasks to become沉淀岗位资产

**Skill Compatibility System** - Cradle can use Skills built in other systems
- Users (administrators) can define and manage Skills in Cradle
- Agent Skills are associated with their job settings, Agents only carry Skills relevant to work objectives
- Skills can handle 80% of secondary development and business expansion scenarios

**Playwright + CDP Process Automation**
- Web simulation operations through headed or headless browser modes, completely solving anti-crawling mechanisms
- Simulating human web visits and data entry operations
- Combined automatic recognition and manual annotation working mode for more Token savings

**Multi-LLM Provider Support**
- Multi-LLM provider routing and aggregation capabilities, can simultaneously connect to APIs from different platforms
- Allows configuring different API Key connection instances for the same provider to optimize Token usage strategy
- Cradle can dynamically select LLM access instances based on Token quotas and subscription methods

**Multi-IM Channel Access Support**
- Support for multiple IM channel access: Whatsapp, Wechat, DingTalk, etc.
- IM identity normalization processing, supporting unified identity across multiple channels, recognizing the same person from different channels

**Agent-Executor Separation Architecture**
- **Agent**: Carries complete context, identifies user intent to orchestrate tasks, provides non-blocking conversation capability, tasks don't affect conversation during execution
- **Executor**: Only carries work context, focused goals with concise and isolated efficient context
- **Handler**: Simple command task execution, handles instructions that can be completed at any time
- **Agent**: New and old tasks can be processed in parallel

## Tech Stack

### Backend

| Technology | Version | Description |
|------------|---------|-------------|
| TypeScript | 5.3+ | Development Language |
| Node.js | 24.14.1 | https://nodejs.org/dist/v24.14.1/node-v24.14.1-x64.msi |
| Python | 3.13.5 | https://www.python.org/ftp/python/3.13.5/python-3.13.5-amd64.exe |
| Fastify | 4.25+ | Web Framework |
| SQLite | 12.8+ | Database (precompiled binary included) |
| WebSocket | 8.19+ | Real-time Communication |
| Playwright | 1.40+ | Browser Automation |

### Frontend

| Technology | Version | Description |
|------------|---------|-------------|
| Vue 3 | 3.4+ | Frontend Framework |
| TypeScript | 5.3+ | Development Language |
| Vben Admin | 5.0+ | Admin Dashboard Template |
| Ant Design Vue | 4.x | UI Component Library |
| Pinia | 2.x | State Management |

## Quick Start

### ⚠️ Important Notes

**Avoid using non-English characters (including spaces) in the project folder path to prevent unexpected issues.**

### Development Environment Setup

We recommend using **Trae** as the development IDE. The following extensions are recommended:

| Extension Name | Description |
|----------------|-------------|
| SQLite3 Editor | SQLite database visual editing |
| i18n Ally | Internationalization assistant tool |
| Iconify IntelliSense | Icon library intelligent prompts |
| ESLint | Code linting |
| Code Formatter & Minifier | Code formatting and compression |
| Tailwind CSS IntelliSense | Tailwind CSS intelligent prompts |
| Vue (Official) | Vue official extension |

### Environment Requirements

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Git

### Installation Steps

1. **Clone the project**

```bash
git clone https://github.com/Frikey1977/Cradle.git
```

2. **Initialize the database**

```bash
# Copy data.init folder to data to complete database initialization
cp -r data.init data
```

3. **Install dependencies**

```bash
# Enable corepack
npm install -g pnpm

# Install project dependencies
npx pnpm install
```

4. **Deploy precompiled binary files (Windows recommended)**

The project includes precompiled better-sqlite3 binary files, automatically installed during deployment:

```bash
# Install dependencies
npx pnpm install

# Deploy precompiled binary files
node prebuilt/install-sqlite.js
```

> ℹ️ Precompiled files are located in `prebuilt/win32-x64/`, supporting Node.js 24.x. If deployment fails, please refer to [Manual Compilation](#manual-compilation).

5. **Configure environment variables**

```bash
# Copy environment variable template
cp .env.example .env

# Edit .env file with necessary parameters
```

6. **Start services**

In Trae, @Builder: Start services to automatically start all services.

```bash
# Start Gateway Master (main service)
npx pnpm run gateway:master

# Start Cradle API Service (in another terminal)
npx pnpm run dev

# Start Cradle frontend service (in another terminal)
cd web/playground
npx pnpm install
npx pnpm dev
```

### Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| Cradle Web UI | http://localhost:5555 | Frontend admin interface, select Admin login |
| Cradle API Service | http://localhost:5320/api/health | API service health check |
| Cradle Gateway Master | http://localhost:3000/health | Gateway main service health check |
| Cradle Browser MCP | http://localhost:18791/health | Browser MCP service health check |

## Project Structure

```
cradle/
├── src/                          # Backend source code
│   ├── agent/                    # Agent runtime
│   │   ├── browser/              # Browser automation
│   │   ├── context/              # Context management
│   │   ├── executor/             # Executor
│   │   ├── heartbeat/            # Heartbeat mechanism
│   │   ├── memory/               # Memory system
│   │   ├── runtime/              # Runtime core
│   │   ├── skills/               # Skill system
│   │   └── tools/                # Tool set
│   ├── gateway/                  # Gateway layer
│   │   ├── channels/             # Channel management
│   │   ├── core/                 # Core logic
│   │   └── routes/               # API routes
│   ├── llm/                      # LLM integration
│   │   ├── adapters/             # Adapters
│   │   ├── providers/            # Provider management
│   │   └── runtime/              # Runtime
│   ├── organization/             # Organization management
│   ├── system/                   # System management
│   └── store/                    # Data storage
├── web/                          # Frontend code
│   ├── apps/                     # Application directory
│   ├── packages/                 # Shared packages
│   └── playground/               # Main application
├── design/                       # Design documents
│   ├── agent/                    # Agent design
│   ├── core/                     # Core design
│   ├── gateway/                  # Gateway design
│   ├── memory/                   # Memory system design
│   └── system/                   # System design
└── scripts/                      # Utility scripts
```

## Core Features

### 1. Agent Management

- Create and configure enterprise Agents
- Agent and employee binding
- Agent skill management

### 2. Memory System

- **Four-layer Memory Architecture**
  - Conversation Layer: Short-term conversation history
  - Work Layer: Work task memory
  - Knowledge Layer: Domain knowledge base
  - Archive Layer: Long-term identity information

- **Five-profile System**
  - Enterprise Profile
  - Department Profile
  - Position Profile
  - Employee Profile
  - Agent Profile

### 3. Skill System

- YAML-based skill definition
- Tool invocation capabilities
- Browser automation
- Custom skill development

### 4. Multi-channel Access

- Web interface (main entry)
- WebSocket real-time communication
- Extensible channel architecture

### 5. LLM Integration

- Multi-provider support (OpenAI, Anthropic, Alibaba Qwen, etc.)
- Load balancing and failover
- Unified adapter interface

## Documentation

- [Design Documents](./design/README.md) - System architecture and design specifications
- [Database Design](./design/DATABASE_SPECIFICATION.md) - Data table structures
- [Coding Standards](./design/CODING_STANDARDS.md) - Development standards
- [Gateway Documentation](./design/gateway/README.md) - Gateway layer design

## Contributing Guide

1. Fork this repository
2. Create feature branch: `git checkout -b feat/xxx`
3. Commit changes: `git commit -am 'feat: add xxx'`
4. Push branch: `git push origin feat/xxx`
5. Submit Pull Request

### Commit Convention

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Refactoring
- `test`: Tests
- `chore`: Build/tools

## License

This project adopts the **Apache License 2.0** open source license.

### Terms of Use

- **Personal and Commercial Enterprise Self-use**: Completely free, you have full rights to use and secondary develop, and own the intellectual property
- **Product Packaging and Commercial Services**: Using this project for any form of product packaging, and providing commercial paid services to any third party, requires written authorization

### Authorization Contact

For commercial authorization, please contact: **frikey@126.com**

---

## Technical Support & Services

The Cradle development team provides professional paid technical services to users, including but not limited to:

| Service Type | Description |
|--------------|-------------|
| **System Implementation Consulting** | Help enterprises quickly complete Cradle system deployment and integration |
| **Business Solution Consulting** | Provide AI assistant application scenario solution design based on industry characteristics |
| **Secondary Development Technical Training** | Provide in-depth training on Cradle architecture, skill development for technical teams |
| **Product Feature Custom Development** | Customize and extend features according to enterprise specific needs |

For service requirements, welcome to contact: **frikey@126.com**

---

## Ecosystem Development Plan

We sincerely invite more knowledgeable people to join the Cradle ecosystem construction and jointly promote the development of the enterprise AI assistant field:

### We Are Looking For

- **Architecture Developers** - Deep understanding of system architecture, able to drive Cradle technical evolution
- **Industry Experts** - Business thinking, able to deeply integrate AI technology with industry scenarios

### Shared Vision

We believe the enterprise AI assistant market has huge potential. Through ecosystem construction, we can not only provide better services to enterprise customers, but also share value and distribute new wealth opportunities in this intelligent transformation.

**Let's make the pie bigger and share the future together!**

Contact email: **frikey@126.com**

---

## Appendix

### Manual Compilation

If precompiled binary deployment fails, you can manually compile better-sqlite3:

**Prerequisites**:
- Visual Studio Build Tools or Visual Studio (including C++ workload)
- Python 3.x

**Compilation Steps**:
```bash
# Enter better-sqlite3 directory and recompile
cd node_modules/better-sqlite3
npx node-gyp rebuild
cd ../..
```

**Package Precompiled Files (for team use)**:
```bash
# Run packaging script in compiled environment
node scripts/package-sqlite-binary.js

# Commit generated prebuilt/ directory to Git for other members to use
```
