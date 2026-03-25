
## Centralize Auth: Replace Scattered getUser() Calls with AuthContext

### Problem
`supabase.auth.getUser()` performs a server round-trip (JWT verification) on every call. Currently 10+ components/hooks call it independently on load, all at the same moment right after login.

### Solution
Create a single `AuthContext` that holds the resolved `User` object, populated once via `onAuthStateChange` (which reads from local memory/storage — no network). All hooks and components consume `useAuth()` instead of calling `getUser()`.

`getUser()` (network) is kept only in `App.tsx`'s initial security hydration, where it belongs.

---

### Files to Create

**`src/contexts/AuthContext.tsx`**
- Subscribes to `supabase.auth.onAuthStateChange` once
- Exposes `{ user, userId, loading }` via `useAuth()` hook
- `AuthProvider` wraps the whole app at the top of `App.tsx`
- Uses `getSession()` (local read) to seed state on mount — no network call

---

### Files to Update

**`src/App.tsx`**
- Wrap `<MainApp>` in `<AuthProvider>`
- `hydrateFromSession` continues to use `getUser()` for the one-time security check at login

**`src/contexts/ProfileContext.tsx`**
- Replace `supabase.auth.getUser()` with `const { user } = useAuth()`
- `loadProfile` now receives `user.id` from context

**`src/hooks/useNotifications.ts`**
- Add `const { userId } = useAuth()` at hook level
- Add `userId` to `queryKey: ["notifications", userId]`
- Add `enabled: !!userId` so query skips when not logged in
- Remove `getUser()` from inside `queryFn`

**`src/hooks/useUserSettings.ts`**
- Replace `getUser()` call with `const { userId } = useAuth()`
- Pass `userId` as a dependency instead of fetching it

**`src/hooks/useBilling.ts`**
- Replace `getUser()` call with `const { userId } = useAuth()`

**`src/hooks/useFriends.ts`** (4 `getUser()` calls)
- Add `const { user, userId } = useAuth()` at each hook
- Pass `userId` into `queryKey` and `enabled: !!userId`
- Remove `getUser()` from inside each `queryFn`

**`src/hooks/useTransactionHistory.ts`**
- Same pattern: replace `getUser()` with `useAuth()`

**`src/pages/Home.tsx`**
- Replace `getUser()` in the main `useEffect` with `const { user } = useAuth()`
- Run the `useEffect` when `user` changes rather than fetching it manually

**`src/components/home/HomeLayoutSheet.tsx`**
- Replace both `getUser()` calls (load + save) with `const { user } = useAuth()`

---

### What Does NOT Change
- `App.tsx`'s `hydrateFromSession` keeps its `getUser()` call — this is the one legitimate security verification
- `Flights.tsx` search execution calls can stay as-is (user-triggered actions, not startup load)
- Account sub-screens (`NotificationsScreen`, `AppearanceScreen`, etc.) are opened on-demand — lower priority, not part of the login burst

---

### Technical Notes

**Why `getSession()` instead of `getUser()` in the new context?**
`onAuthStateChange` fires with a `session` object directly — no extra network call. The `session.user` is already the resolved user. This is the Supabase-recommended pattern for app-level auth state.

**React Query hooks** will get `userId` in their `queryKey` so React Query deduplicates and caches correctly. The `enabled: !!userId` guard ensures they only fire once the user is known.

**ProfileContext** currently lives only inside the logged-in gate, so wrapping it in `AuthContext` is safe — `useAuth()` will always return a valid user there.
