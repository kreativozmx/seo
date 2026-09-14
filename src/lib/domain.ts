// Strips protocol, "www.", path/query/hash and trailing slashes so domains
// are stored consistently regardless of how the user typed them
// (https://www.example.com/foo -> example.com).
export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
}
