## Problem

Production build fails with:
```
Could not load /dev-server/src/utils/blackoutdates (imported by src/pages/AdminBulkSearch.tsx)
```

The file is actually `src/utils/blackoutDates.ts` (capital `D`). Local/preview filesystems are case-insensitive, so it works in dev — but the production build runs on a case-sensitive Linux filesystem and fails.

(The `crypto` warning from `sql.js` is just a warning, not the cause. The `_sandbox/dev-server` 404 is unrelated noise.)

## Fix

Single-line edit in `src/pages/AdminBulkSearch.tsx` line 19:

```ts
// before
import { isBlackoutDate } from "@/utils/blackoutdates";
// after
import { isBlackoutDate } from "@/utils/blackoutDates";
```

After this change, re-run the publish/promote-to-PROD flow.