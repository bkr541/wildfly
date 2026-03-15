

# Fix Auth Session Gating and Onboarding Flow

## Problem Summary
When a user refreshes the page, the app may flash the wrong screen (Auth instead of Home, or Onboarding when it shouldn't) because the current auth initialization doesn't properly handle all cases -- particularly users who have a valid session but no `user_info` row yet. Additionally, after splash completes, there's no loading gate while the session is still being checked.

## What's Already Working
- Onboarding image paths are already correct (`/assets/onboarding/backgroundX.png`)
- Background CSS properties (cover, center, no-repeat) are already in place
- No ref is being passed to `<Onboarding />`, so no ref warning fix is needed

## Changes (single file: `src/App.tsx`)

### 1. Replace `checkProfile` with `hydrateFromSession(session)`

A new async helper that handles all session states:

- **No session/user**: Sets `isSignedIn=false`, `needsOnboarding=false`, `showProfileSetup=false`, `checkingSession=false`
- **User exists, no `user_info` row**: Inserts a new `user_info` row (with `auth_user_id`, `email`, `onboarding_complete: "No"`, `image_file: ""`), then sets `isSignedIn=true`, `needsOnboarding=true`
- **User exists, profile found**: Sets `isSignedIn=true`, `needsOnboarding` based on `onboarding_complete` value
- Always calls `setCheckingSession(false)` at the end

### 2. Update the `useEffect` auth listener

- Call `supabase.auth.getSession()` first, pass result to `hydrateFromSession`
- Subscribe to `onAuthStateChange` -- for events `SIGNED_IN`, `SIGNED_OUT`, `USER_UPDATED`, `INITIAL_SESSION`, call `hydrateFromSession(session)`
- Keep `isMounted` guard and `subscription.unsubscribe()` cleanup

### 3. Add a loading gate after splash

After `splashDone === true`, if `checkingSession` is still `true`, render a simple loading placeholder (e.g., a centered spinner or blank screen with the app background). This prevents flashing Auth/Onboarding/Home before the session state is resolved.

## Technical Details

```text
Mount
  |
  v
getSession() -----> hydrateFromSession(session)
  |                        |
  v                        v
onAuthStateChange -----> hydrateFromSession(session)
  |
  v
checkingSession = false --> render correct screen
```

### Files changed:
- `src/App.tsx` -- refactored auth initialization logic, added loading gate

### No changes needed:
- `src/components/Onboarding.tsx` -- paths and CSS already correct
- `src/components/AuthPage.tsx` -- sign-up/sign-in logic unchanged
- No ref fixes needed (no ref passed to Onboarding)

