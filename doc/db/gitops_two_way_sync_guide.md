# Supabase & GitHub GitOps Two-Way Synchronization Guide

This guide details the architecture, setup instructions, and database queries required to configure the **Bidirectional GitOps Pipeline** between the **Supabase Database** (`public.event_submissions`) and the **GitHub Repository** (`raids.json`).

---

## 1. Synchronization Architecture

```
  ┌────────────────────────────────────────────────────────┐
  │         Event Raiders Staff Review Dashboard           │
  │   (Staff clicks "Approve Proposal" on an event update) │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │                 Supabase PostgreSQL DB                  │
  │     UPDATE public.event_submissions (status='approved')│
  └───────────────────────────┬────────────────────────────┘
                              │
            [PostgreSQL Trigger: pg_net http_post]
                              │
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │             GitHub REST API Dispatch Endpoint          │
  │    POST /repos/oU1TS/events/dispatches                 │
  │    Body: {"event_type": "sync_raids_from_db"}          │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │           GitHub Actions: sync-database-raids.yml      │
  │   1. Fetches approved records from Supabase            │
  │   2. Merges & normalizes canonical key order in JSON   │
  │   3. Updates tracker.json & regenerates feed.xml       │
  │   4. Commits & pushes to main branch with [skip ci]    │
  └───────────────────────────┬────────────────────────────┘
                              │
                              ▼
  ┌────────────────────────────────────────────────────────┐
  │              Local Maintainers / Production            │
  │  Running `git pull` pulls freshly approved events!     │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Setup Prerequisites

### Step 1: Generate a GitHub Personal Access Token (PAT)
To allow Supabase to trigger GitHub Actions via `repository_dispatch`, you need a GitHub Personal Access Token.

> [!NOTE]
> Personal Access Tokens belong to your **personal GitHub user account**, not an organization dashboard.

1. Go to your personal GitHub settings: **[github.com/settings/tokens](https://github.com/settings/tokens)**.
2. Select **Tokens (classic)** ➔ **Generate new token (classic)**:
   - **Note**: `Supabase Webhook Event Raiders Dispatch`
   - **Expiration**: 90 days, 1 year, or No expiration.
   - **Scopes**:
     - Check `repo` (if repository is private) OR `public_repo` (if repository is public).
3. Click **Generate token** and copy the token starting with `ghp_...` (or `github_pat_...`).

*(If using Fine-Grained Tokens, select **Resource owner: oU1TS**, choose the **events** repository, and set **Repository permissions ➔ Contents: Read and write**).*

---

## 3. Database SQL Queries (Run in Supabase SQL Editor)

Navigate to your [Supabase Dashboard](https://supabase.com/dashboard) ➔ **SQL Editor**, and run the following queries:

### Query 1: Grant Public/Anonymous Read Access to Approved Submissions (RLS)
This ensures the GitHub Actions sync script can query approved submissions without needing a privileged service role key:

```sql
-- Allow anonymous visitors and GitHub Actions to read approved event proposals
DROP POLICY IF EXISTS "Public can view approved submissions" ON public.event_submissions;
CREATE POLICY "Public can view approved submissions" ON public.event_submissions
    FOR SELECT
    USING (status = 'approved');
```

---

### Query 2: Create the Real-Time GitHub Actions Dispatch Trigger
This sets up a PostgreSQL trigger utilizing the `pg_net` extension. Whenever a staff member approves a submission (`status = 'approved'`), Supabase automatically makes an HTTP `POST` to GitHub's dispatch API:

```sql
-- 1. Ensure pg_net extension is active
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Create the dispatch function
CREATE OR REPLACE FUNCTION public.dispatch_github_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Trigger dispatch ONLY when a submission transitions to 'approved'
  IF (NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved')) THEN
    PERFORM
      net.http_post(
        url := 'https://api.github.com/repos/oU1TS/events/dispatches',
        headers := jsonb_build_object(
          'Authorization', 'Bearer <YOUR_GITHUB_PAT>',
          'Accept', 'application/vnd.github+json',
          'User-Agent', 'Supabase-Webhook',
          'Content-Type', 'application/json'
        ),
        body := '{"event_type": "sync_raids_from_db"}'::jsonb
      );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger to public.event_submissions
DROP TRIGGER IF EXISTS trigger_dispatch_github_sync ON public.event_submissions;
CREATE TRIGGER trigger_dispatch_github_sync
AFTER UPDATE ON public.event_submissions
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_github_sync();
```

> [!IMPORTANT]
> Replace `<YOUR_GITHUB_PAT>` with your actual token from Step 1 before executing the query.

---

## 4. Why Use a Native Postgres Trigger Instead of the UI Webhooks Page?

In Supabase's visual Webhooks page (`Integrations ➔ Webhooks`), the dashboard sends a default fixed envelope:
```json
{
  "type": "UPDATE",
  "table": "event_submissions",
  "record": { ... }
}
```
GitHub's dispatch API (`/repos/oU1TS/events/dispatches`) strictly mandates the request body:
```json
{
  "event_type": "sync_raids_from_db"
}
```
Attempting to map this in the UI "HTTP Parameters" field passes it as URL query parameters (`?application/json=...`), causing GitHub to respond with `HTTP 422: event_type is missing`.

Using the native PostgreSQL trigger with `net.http_post`:
1. Sends the **exact JSON payload** GitHub expects.
2. Only fires on real approvals (`NEW.status = 'approved'`).
3. Leaves the Supabase Webhooks UI clean with zero brittle configurations.

---

## 5. Verification & Diagnostics

### 1. Inspect Outgoing HTTP Responses in Supabase
You can view outgoing webhook HTTP responses sent by `pg_net` directly in the Supabase SQL Editor:

```sql
SELECT id, status_code, error_msg, created_at 
FROM net._http_response 
ORDER BY id DESC 
LIMIT 5;
```
* **Status Code `204`**: GitHub successfully received the dispatch and triggered the workflow.
* **Status Code `401` / `403`**: Invalid PAT or missing `contents: write` permissions.
* **Status Code `422`**: Malformed body or unknown `event_type`.

### 2. Verify Workflow Execution on GitHub
Open: **`https://github.com/oU1TS/events/actions`**
- Look for workflow **"Sync Database Approved Raids to Git"** (`sync-database-raids.yml`).
- It will show a successful run by `github-actions[bot]` with the commit message:
  `chore(sync): update raids.json from database approvals [skip ci]`

### 3. Verify Local Consistency
In your local workspace:
```bash
git pull origin main
```
`raids.json`, `tracker.json`, and `feed.xml` will be completely synchronized with the database updates!

