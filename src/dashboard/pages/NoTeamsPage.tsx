import type { AuthUser } from "../lib/api";

interface Props {
  user: AuthUser;
}

export function NoTeamsPage({ user }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <div className="card bg-base-100 shadow-xl max-w-md w-full">
        <div className="card-body flex flex-col items-center text-center">
          {user.picture && (
            <div className="flex justify-center mb-2">
              <img
                src={user.picture}
                alt=""
                className="w-16 h-16 rounded-full"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <h1 className="text-xl font-bold">No teams assigned</h1>
          <p className="text-base-content/70 mt-2">
            You haven&apos;t been assigned to any teams yet. Contact an admin to get access.
          </p>
          <div className="mt-6">
            <a href="/auth/logout" className="btn btn-ghost btn-sm">
              Sign out
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
