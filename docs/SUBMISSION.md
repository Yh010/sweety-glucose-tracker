# Submission evidence

- [Live app](https://sweety-glucose-tracker-kagf.onrender.com/) — register an account to try it.
- [Download the video and screenshot pack](https://github.com/Yh010/sweety-glucose-tracker/releases/tag/assessment-submission).
- [Successful full CI run](https://github.com/Yh010/sweety-glucose-tracker/actions/runs/43164276779).

The pack contains a 2 minute 2 second recording of the deployed app, optional captions, 12 desktop/mobile screenshots, a CSV exported through the UI, and verification/checksum files. All demonstrated accounts and readings are synthetic.

The walkthrough covers registration, validation, all four reading slots, the daily limit, editing, daily reports, CSV export, confirmed deletion, historical readings, month-to-date trends, the complete previous month, and logout. Mobile screenshots cover the daily log and reports. The recording is silent and preserves the real interface.

Media verification: 1440 × 1000, 25 fps, H.264/yuv420p, full decode passed, zero captured browser errors, independent sampled visual review passed. Live HTTPS health and Secure/HttpOnly/SameSite=Lax cookies were checked separately. The video SHA-256 is `15d9afe0e5d319bbd156738eaf574ef8adfbfd0899441445955c620ef1f1ff56`.

The full CI run includes 111 tests (46 backend, 10 optional-infrastructure integration, 15 frontend, 40 browser), production HTTPS container checks, database backup/restore verification, and restart recovery. A transient Chrome network-change error after Docker restart is retried only during initial navigation, up to three attempts; assertions and mutations are never retried by that check.

## Screenshots

| State                   | Evidence                                                          |
| ----------------------- | ----------------------------------------------------------------- |
| Sign in                 | [Login](screenshots/submission/01-login.png)                      |
| Registration            | [Account creation](screenshots/submission/02-register.png)        |
| First use               | [Empty daily log](screenshots/submission/03-empty-daily.png)      |
| Invalid reading         | [Validation](screenshots/submission/04-validation.png)            |
| Four daily readings     | [Complete day](screenshots/submission/05-day-complete.png)        |
| Daily summary           | [Daily report](screenshots/submission/06-daily-report.png)        |
| Deletion                | [Confirmation](screenshots/submission/07-delete-confirmation.png) |
| Historical account      | [Daily log](screenshots/submission/08-daily-history.png)          |
| This month              | [Month to date](screenshots/submission/09-month-to-date.png)      |
| Previous calendar month | [Previous month](screenshots/submission/10-previous-month.png)    |
| Mobile daily log        | [Mobile log](screenshots/submission/11-mobile-daily.png)          |
| Mobile reports          | [Mobile reports](screenshots/submission/12-mobile-reports.png)    |

## Hosting scope

The free Render demo has a single API process and PostgreSQL. Optional Redis caching and the scheduled reminder worker are not running on this free deployment; their implementation and tested production setup remain in the repository. Free service wake-up delays and the 30-day database expiry are documented in [RENDER.md](RENDER.md). The optional doctor-role extension is not implemented.
