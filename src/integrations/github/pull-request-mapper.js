export function mapPullRequest({ pullRequest, changedFiles }) {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    state: pullRequest.state,
    changedFiles: changedFiles.map((file) => ({
      path: file.filename,
      previousPath: file.previous_filename || null,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions
    }))
  };
}
