# Password-Protected GitHub Action Refresh Trigger

This plan adds a password-protected **Admin Refresh** button in the **AI Macro Testbed** header pre-configured with your static password **`chicken12`** (which you can easily update at any time) that triggers your GitHub Actions workflow (`daily-5am-refresh.yml`) to run all market data and macro news refreshes and publish to `porkbun-deploy`.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Pre-Configured Static Password (`chicken12`)**:
> - The Admin Refresh modal is pre-configured with the static password **`chicken12`**.
> - We store the password configuration cleanly in a dedicated config constant (`ADMIN_STATIC_PASSWORD = "chicken12"` in `src/utils/adminAuth.ts`) and also allow changing it in the UI settings drawer so you can update it anytime if required.
> - To let the browser trigger GitHub Actions (`POST /repos/tkengl-qwerty/ai-dashboard/actions/workflows/daily-5am-refresh.yml/dispatches`) when you enter `chicken12`, the modal also supports storing your GitHub Fine-Grained Token (encrypted with `chicken12` via AES-256-GCM or via GitHub's build secret `VITE_ENCRYPTED_GH_TOKEN` during the GitHub Action build).

- **Confirmed Decision 1 (Default Static Password `chicken12`)**: Set the static password to **`chicken12`** out of the box, with a single clear constant (`src/utils/adminAuth.ts`) and UI override so you can change it whenever needed.
- **Confirmed Decision 2 (Single Source of Truth via GitHub Actions)**: Entering **`chicken12`** and clicking **Trigger GitHub Refresh** dispatches `daily-5am-refresh.yml` (`ref: main`), running `scripts/update_daily_macro.py` + `npm run build` + `porkbun-deploy` push.
- **Confirmed Decision 3 (Auto-Encrypted Build Support in GitHub Actions)**: Update `daily-5am-refresh.yml` so that if you add a repository secret `GH_WORKFLOW_TOKEN` (or configure it once in the modal), it automatically encrypts the token with **`chicken12`** at build time—meaning on Porkbun you only ever have to type **`chicken12`** and click **Refresh**.

---

## 1. Overview & Core Concept

- **What It Does**: Places an **Admin Refresh** lock button next to `Reload` in the header bar. When clicked, you enter **`chicken12`**, which triggers the `daily-5am-refresh.yml` GitHub Action on `tkengl-qwerty/ai-dashboard`, tracks the workflow run status (`Queued` → `In Progress` → `Completed`), and reloads the refreshed `daily_macro.json` data.
- **Target Audience / Persona**: Exclusively you (the site owner) when you want to trigger a full refresh of market data and macro news prior to 5:00 AM SGT using your password **`chicken12`**.
- **Key Value**: Simple, single-password experience (`chicken12`) that runs your complete GitHub Actions data & news pipeline on demand.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Everyday Refresh with `chicken12`**:
     - Click **`Admin Refresh`** (lock icon) in the top-right header next to `Reload`.
     - Type **`chicken12`** into the password field and click **`Trigger GitHub Refresh`**.
     - The modal verifies the password, dispatches `daily-5am-refresh.yml` (`ref: main`), displays live workflow progress, and reloads the dashboard once complete.
  2. **Updating Password or Token (Optional Settings Drawer)**:
     - Inside the modal (unlocked only after entering `chicken12`), a collapsible **`Settings`** section lets you update the static password or paste/update the GitHub Actions token (`Actions: Read & Write` on `tkengl-qwerty/ai-dashboard`) if ever needed.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Matches the **AI Macro Testbed** Brushed Metal & Blue aesthetic (`#0e141d`, `#131b27`, `#192434`, cobalt `#3b82f6`, sky `#38bdf8`).
  - *Typography & Hierarchy*: Clean sans-serif headers with `JetBrains Mono` (`tabular-nums`) for workflow status timestamps and direct links to the GitHub Action run.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Static Password `chicken12` + Central Config Constant**
  - *Chosen Approach*: Define `DEFAULT_ADMIN_PASSWORD = "chicken12"` in `src/utils/adminAuth.ts` so it works immediately and is trivial to edit in code or via the modal's Settings panel.
  - *Why*: Directly matches your request for a simple static password `"chicken12"` that you can update later if required.
- **Decision 2: Seamless GitHub Actions Dispatch (`daily-5am-refresh.yml`)**
  - *Chosen Approach*: Trigger `POST https://api.github.com/repos/tkengl-qwerty/ai-dashboard/actions/workflows/daily-5am-refresh.yml/dispatches` with `{"ref": "main"}` upon password verification.
  - *Why*: Ensures the exact same Python fetcher (`scripts/update_daily_macro.py`), Gemini Search Grounding, sense-check, and Porkbun static build run every time.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Header Bar (Header.tsx)                         │
│   [Reload]   [🔒 Admin Refresh] ──► Opens AdminRefreshModal.tsx         │
└────────────────────────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   AdminRefreshModal.tsx (Password Gate)                 │
│  1. User enters password ("chicken12")                                  │
│  2. Verifies against ADMIN_STATIC_PASSWORD ("chicken12")                │
│  3. Unlocks GitHub token & calls GitHub REST API:                       │
│     POST /repos/tkengl-qwerty/ai-dashboard/actions/workflows/           │
│          daily-5am-refresh.yml/dispatches  ({ ref: "main" })            │
└────────────────────────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              GitHub Actions (daily-5am-refresh.yml on Ubuntu)           │
│  • Runs `python scripts/update_daily_macro.py` (Treasury, YF, Gemini)   │
│  • Runs `npm run build` (packages fresh public/data/daily_macro.json)   │
│  • Pushes `dist/` to `porkbun-deploy` branch for Porkbun Static Hosting │
└────────────────────────────────────────────┬────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│        Modal polls workflow completion & calls onRefresh() in UI        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State
- **Admin Auth & Dispatch Utility (`src/utils/adminAuth.ts`)**:
  - `DEFAULT_ADMIN_PASSWORD = "chicken12"` — Easy-to-edit static password constant.
  - `verifyAdminPassword(input: string): boolean` — Validates against `"chicken12"` (or any updated password saved by the owner).
  - `triggerGitHubRefreshWorkflow(password: string): Promise<{ ok: boolean; message: string; runUrl?: string }>` — Verifies the password, decrypts/uses the configured GitHub Actions token, and dispatches `daily-5am-refresh.yml` on `tkengl-qwerty/ai-dashboard`.
- **Interactive Component & State Mapping**:
  - `Header.tsx`: Adds the `Admin Refresh` lock button next to `Reload`.
  - `AdminRefreshModal.tsx`: Password prompt (`chicken12`), one-click `Trigger GitHub Refresh` button, live workflow run polling (`queued` → `in_progress` → `completed`), and owner settings to update the password or GitHub token.
