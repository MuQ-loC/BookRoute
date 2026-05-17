# Public Web Search Policy

BookRoute can search public websites, but public does not mean unlimited reuse.

## Allowed

- Open normal search result pages.
- Use official APIs when available.
- Link to public pages instead of copying full content.
- Extract minimal metadata for routing:
  - title
  - author
  - ISBN
  - publisher
  - year
  - source URL
  - short user-written note
- Search GitHub for:
  - book lists
  - legal companion code
  - reading notes
  - open licensed learning resources
- Search CSDN for:
  - reviews
  - version identification
  - setup notes
  - legal learning notes

## Not Allowed

- Searching for netdisk piracy links.
- Returning extraction codes.
- Adding LibGen, Z-Library, piracy mirrors, or similar infringement-oriented sources to the public matrix.
- Bulk crawling article bodies.
- Copying full copyrighted articles into our database.
- Bypassing login, paywalls, anti-crawler measures, rate limits, or platform rules.
- Republishing CSDN/GitHub content as if it were ours.
- Storing suspected infringing book PDFs or transfer links.

## Product Rule

BookRoute stores routes, not stolen files.

The product should say:

```text
I can help you find legal acquisition routes and public reference pages.
I cannot help you find pirated downloads or netdisk transfer links.
```

## GitHub

Prefer official GitHub search pages or GitHub REST API. Keep requests rate-limited and store only repository metadata and links.

## CSDN

Use CSDN as a manual search route first. Do not scrape article bodies in the MVP.
