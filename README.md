# Excuse Generator

A phone-first web app: say what you are late or absent for, when, and who you
are telling. It hands back three excuse slips (Safe, Creative, Bold) built from
real context: weather, an estimated traffic level, your city and nearby events.

Hobby project on Vercel Hobby: no ads, no payments, no accounts.

## Run it

```sh
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run lint && npm run typecheck
```

Requires Node 22 or newer.

## Environment

All variables are optional; see `.env.example`. Copy it to `.env.local`.

| Variable                                   | Without it                              |
| ------------------------------------------ | --------------------------------------- |
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | template excuses, marked "Offline mode" |
| `TICKETMASTER_API_KEY`                     | demo events, marked "Demo data"         |

## Privacy

No accounts, no analytics, no cookies. The server never logs your reason or
place. Coordinates are rounded to about 1 km and never sent to the LLM; history
stays in your browser's localStorage. Traffic is always an estimate from the
clock and the weather, and is labelled as such.

## Deploy

Import the repo in Vercel (Hobby). Every push to `main` deploys. Set the
variables above in Project Settings, Environment Variables.

## Licence

MIT, by Akrem Medimagh.
