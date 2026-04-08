

## Plan: Add "Manage Users" Admin Screen

### What we're building
A new admin-only "Manage Users" icon in the Account Hub header (next to the existing code/developer icon), plus a full Manage Users screen that lists all app users with expandable detail panels showing subscription, settings, credits, and transaction data.

### Changes

**1. MainLayout.tsx — Add UserGroupIcon button for developers (line ~343)**

Insert a new `UserGroupIcon` button immediately before the existing `SourceCodeIcon` button, inside the same `isDeveloper && currentPage === "account"` conditional. Wire it to a new callback prop `onAccountManageUsersPress`.

**2. App.tsx — Wire new callback**

Add the `onAccountManageUsersPress` handler that tells AccountHub to open the "manage-users" screen (same pattern as `onAccountDevPress` for developer tools).

**3. AccountHub.tsx — Register new screen**

- Add `"manage-users"` to `screenTitles`
- Add a case for `activeScreen === "manage-users"` that renders the new `ManageUsersScreen`
- Wire a new `manageUsersRef` (same pattern as `devRef`) so the header button can trigger it

**4. New file: `src/components/account/ManageUsersScreen.tsx`**

The main new component:

- **Data fetching**: Query `user_info` for all discoverable users (RLS allows authenticated SELECT on discoverable users). For each expanded user, fetch from `user_subscriptions`, `user_settings`, `user_credit_wallet`, and `credit_transactions` using service-level queries. *Note: RLS restricts these tables to the owning user, so we'll need a new edge function or RPC to fetch other users' data.*
- **RLS limitation**: Current RLS policies only let users read their own subscription/settings/wallet/transactions. We need a **new edge function** (`admin-user-details`) that uses the service role key to fetch another user's data, gated by checking the caller is in `developer_allowlist`.
- **List UI**: White rounded card with user rows showing avatar, display name, username, email. Each row has Edit (pencil) and Delete (trash) icons on the right. Clicking a row expands a collapsible section below.
- **Expanded detail**: Four grouped sections (Subscription, Settings, Credit Wallet, Transactions) using the app's existing card/accordion style with the green icon palette (`bg-surface-active`, `#047857` icons, `#2E4A4A` text, `#6B7B7B` secondary text).
- **Edit/Delete**: Edit navigates to a detail edit view (future); Delete shows a confirmation dialog.

**5. New edge function: `supabase/functions/admin-user-details/index.ts`**

- Accepts `{ target_user_id: string }` in POST body
- Validates caller's JWT, checks `developer_allowlist` for caller's user ID
- Uses service role client to query `user_subscriptions`, `user_settings`, `user_credit_wallet`, `credit_transactions` for the target user
- Returns combined JSON response

**6. New edge function: `supabase/functions/admin-list-users/index.ts`**

- Lists all users from `user_info` (since the discoverable-only RLS policy won't show non-discoverable users)
- Gated by `developer_allowlist` check
- Returns array of user records

### Design details
- Same frosted-glass card style, `#2E4A4A` headings, `#6B7B7B` descriptions
- Collapsible sections use `Collapsible` from Radix (already in project)
- Green icon circles (`bg-surface-active` with `#047857` stroke)
- Skeleton loaders while fetching expanded user details

### Files touched
1. `src/components/MainLayout.tsx` — add UserGroupIcon button + new prop
2. `src/App.tsx` — wire new callback
3. `src/pages/AccountHub.tsx` — register manage-users screen + ref
4. `src/components/account/ManageUsersScreen.tsx` — **new file**
5. `supabase/functions/admin-list-users/index.ts` — **new edge function**
6. `supabase/functions/admin-user-details/index.ts` — **new edge function**

