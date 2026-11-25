# Security

Report a vulnerability through a private GitHub security advisory on this
repository rather than a public issue. Expect a reply within a week.

- API keys live only in server environment variables (Vercel), never in the
  repo or the browser bundle.
- The free-text reason is treated as untrusted data and is not logged.
- History is stored only in your browser (localStorage).
