# End-to-end QA report

Tested on 11 November 2026 using Google Chrome, real Node/Express servers and PostgreSQL. The expanded audit used separate frontend/API ports (5174/4001) and the disposable sweety_test database, preserving the demo database. Browser failures were simulated only for the explicit recovery cases; successful workflows used the actual API and database.

## Results

| Check | Result |
| --- | --- |
| Desktop browser scenarios | 10 passed |
| Mobile browser scenarios | 10 passed |
| Backend unit/integration tests | 25 passed |
| Frontend unit/component tests | 9 passed |
| Backend and frontend production builds | Passed |
| Formatting | Passed |
| Automated WCAG checks inside account/report flows | Zero violations |
| Responsive widths | No horizontal overflow at 320, 390, 768 and 1440 pixels |

## Gaps reproduced and fixed

| Finding | Reproduction | Correction and verification |
| --- | --- | --- |
| Failed deletion did not retry | Interrupt DELETE, restore connectivity, choose Try again; the reading stayed present | The retry action now sends DELETE again. Browser tests confirm the reading disappears and the summary updates |
| Date could change during a pending save | Hold a real save request and inspect the date input and navigation | Date input and both navigation buttons are disabled while a write is pending. Tests verify the disabled state and one successful request |
| Midnight changed the selected journal date | Type a draft, advance metadata to the next day | The chosen day stays selected and the typed value remains. Today still updates the allowed date boundary |

Each gap was observed on the original implementation before the corresponding fix. The final complete audit run passed all 18 browser scenarios. Two additional desktop/mobile dev-server checks then passed without requiring an app change, bringing coverage to 20 browser scenarios.

## Coverage

- Registration, duplicate emails with different case, incorrect login, retained credentials after errors, password visibility, logout, login again, and account switching without cached readings leaking between accounts.
- Required values, below/above limits, decimals, inclusive values 40 and 600, future dates, duplicate slots, four-reading cap, keyboard Enter submission, edit conflicts, moving a reading to another date, cancellation and confirmed deletion.
- Daily table slot ordering; exact minimum/maximum/count/rounded averages; month-to-date cutoff; full previous month; excluded dates outside ranges; leap-day February; December/January boundaries; zero/null empty state and chart rendering.
- Page reload persistence, expired sessions, initial request failure/retry, failed saves with retained drafts, failed deletion/retry, background metadata failure, midnight change and delayed requests.
- Generated test HTML updates do not navigate or clear the login page. Vite reload notices for report pages were investigated and did not reproduce an app reload.
- Login/registration drafts across a simulated 61-second background/foreground transition, with no new profile requests or logged-out polling.
- An 80-character name, responsive layout bounds, automated accessibility checks and desktop/mobile report screenshots attached to the Playwright HTML report.

## Re-run

With the development database and app configuration ready:

```sh
npm test --prefix backend
npm test --prefix frontend
npm run test:e2e --prefix frontend
npm run build --prefix backend
npm run build --prefix frontend
npm run format:check --prefix frontend
```

The Playwright HTML report is generated under frontend/playwright-report (not committed). GitHub Actions uploads it as the browser-results artifact on successful and failed runs. Verified [desktop](qa-screenshots/previous-month-desktop.png) and [mobile](qa-screenshots/previous-month-mobile.png) captures are committed. Browser tests use unique synthetic accounts. Use a disposable database for repeat QA. Existing backend tests isolate themselves in a random schema and clean up that schema.

## Limits

Mobile coverage is Chromium phone emulation, not a physical iPhone or Safari. Firefox and WebKit have not been tested. Automated accessibility checks do not replace a complete manual screen-reader review. Docker Compose has not been executed locally; PostgreSQL-backed CI runs separately. No public app deployment was tested. There are no outstanding failures in the tested scope; these checks do not prove the absence of every possible defect.
