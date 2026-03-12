export function isJobVisibleToTeam(
  jobName: string,
  teamId: number,
  jobTeamIds: Map<string, number[]>,
): boolean {
  const allowedTeams = jobTeamIds.get(jobName);
  if (!allowedTeams) return true;
  return allowedTeams.includes(teamId);
}

/** Returns true if any of the user's teams can see the job. */
export function isJobVisibleToAnyTeam(
  jobName: string,
  userTeamIds: number[],
  jobTeamIds: Map<string, number[]>,
): boolean {
  const allowedTeams = jobTeamIds.get(jobName);
  if (!allowedTeams) return true;
  return userTeamIds.some((tid) => allowedTeams.includes(tid));
}
