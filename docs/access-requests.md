# Access Requests

When `ACCESS_REQUESTS_ENABLED=true`, users who sign in but aren't super-admins or existing enabled users can request dashboard access through a self-service flow.

## How it works

1. A user signs in with Google and lands on the **Request Access** page.
2. They click **Request Access**, which creates a pending access request.
3. A super-admin sees the pending request on the **Users** page and approves or denies it.
4. The requester's page polls automatically and updates when the decision is made.

### After approval

Approved users **must sign in again** to get a fresh session with the correct permissions. The approval page shows a "Sign in again" button that takes them through the OAuth flow, which creates a new session tied to their user record.

### After denial

Denied users see the denial reason (if provided) and can submit a new request.

### Disabled users

If a user's account is later disabled by a super-admin, they see a "Your account has been disabled" message on their next visit, with the option to request access again.

## Environment variables

| Variable | Description |
|---|---|
| `SUPER_ADMINS` | Comma-separated emails that always have full access |
| `ACCESS_REQUESTS_ENABLED` | Set to `true` to enable the self-service flow |

When `ACCESS_REQUESTS_ENABLED` is not set or `false`, unapproved users see a static "Access denied" message with no request option.

## Admin actions

Super-admins manage access requests from the **Users** page in the dashboard:

- **Approve** -- creates a user record (or re-enables a disabled one) and marks the request as approved.
- **Deny** -- marks the request as denied with an optional note explaining why.

Both approve and deny are wrapped in a database transaction for consistency.
