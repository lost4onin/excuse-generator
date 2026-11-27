# Roadmap

## Done

- [x] S0 baseline: licence, SECURITY.md, `.env.example`, typed config, CI, local git hooks (not committed)
- [x] S1 scaffold: Next.js App Router, TypeScript strict, ESLint, Prettier, Vitest
- [x] S2 domain types: Context, Excuse, Audience, Tier
- [x] S3 form: reason, chips, mode, time, audience, validation
- [x] S4 geolocation with manual city fallback
- [x] S5 weather client (Open-Meteo)
- [x] S6 traffic estimator, "Estimated, not live"
- [x] S7 events provider interface, demo provider, "Demo data"
- [x] S8 Ticketmaster provider (env key)
- [x] S9 template fallback engine
- [x] S10 excuse service with fallback wiring (API route already serves templates)
- [x] S11 design tokens and results UI
- [x] S12 copy and share
- [x] S13 local history and repeat warning
- [x] S14 LLM prompt builder
- [x] S15 output schema and content-rule checker

## To do

- [ ] S16 LLM provider adapter (needs key)
- [ ] S17 API route: add the LLM call (route exists, templates only)
- [ ] S18 rate limit and daily budget
- [ ] S19 live smoke script and prompt tuning (needs key)
- [x] S20 phone polish, states, motion, focus
- [ ] S21 docs, Playwright phone smoke, deploy notes
- [ ] SZ security review
- [ ] S22 reviewer pass fixes

## Next up

S16 LLM adapter, waiting for an API key in `.env.local`. Until then: finish S20,
then S21 (Playwright phone smoke, deploy notes).
