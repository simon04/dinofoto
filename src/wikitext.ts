/** Author for own work: a link to the user page of the uploader. */
export function ownWorkAuthor(username?: string): string {
  return username ? `[[User:${username}|${username}]]` : "";
}
