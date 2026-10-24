# FD / SIP flow test - 2026-10-19

Scenario: one FD (matures in 2 days), one SIP due tomorrow, one SIP already past due.
Time passing was simulated by moving the dates into the past directly in the database.

| Screenshot | State |
|---|---|
| 01-created-upcoming.png | Records created. Pending Actions shows them with no buttons. Recent Transactions shows "New FD started" and "SIP started". |
| 02-due-with-buttons.png | Dates reached. Labels read "SIP overdue", "FD matured", "SIP due today", each with a Delete or Mark paid button. |
| 03-after-actions.png | FD deleted, both SIPs marked paid. SIP dates moved forward one month. Recent Transactions shows "FD closed" and "SIP paid". |

API checks:
- Delete / mark paid before the date: 409 (refused).
- Delete / mark paid after the date: 200.
- Repeating either action: 409 (no double payment or duplicate log).
- Mutual Funds total: 60,102 -> 76,102 (+16,000 = two initial amounts + two SIP instalments).
- FD total returns to baseline (1,155,788) once the matured FD is deleted.

All test records were removed afterwards.
