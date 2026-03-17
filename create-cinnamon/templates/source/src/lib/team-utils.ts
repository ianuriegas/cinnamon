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

/** Returns true if the job has no team restriction (visible to everyone). */
export function isDefaultJob(jobName: string, jobTeamIds: Map<string, number[]>): boolean {
  return !jobTeamIds.get(jobName)?.length;
}

/** Returns the names of all config jobs that have no team restriction. */
export function getDefaultJobNames(
  configJobs: Record<string, unknown>,
  jobTeamIds: Map<string, number[]>,
): string[] {
  return Object.keys(configJobs).filter((name) => isDefaultJob(name, jobTeamIds));
}
