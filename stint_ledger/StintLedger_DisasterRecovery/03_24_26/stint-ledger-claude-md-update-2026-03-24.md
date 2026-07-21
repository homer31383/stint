# Prompt to Update CLAUDE.md — 2026-03-24

Hand this to Claude Code in the stint-ledger project:

---

**Update CLAUDE.md with the following context from today's session that you wouldn't know from reading the code alone:**

1. **Planner view section order matters and keeps getting disrupted by new features.** The correct order is:
   - Days to Target (with bookings/pencils checkboxes)
   - Saved Scenarios panel
   - Scenario Inputs (vacation, holidays, sick, expenses, health insurance, growth assumptions, day rate, utilization — in that order)
   - Freelance / Full-Time toggle
   - Monthly Snapshot
   - Freelance / Full-Time toggle (duplicate)
   - Annual View
   - Summary callout
   - Compare mode
   - Scenario Comparison Table
   - 5-Year Net Worth Projection
   - Rollover IRA Deployment Comparison

2. **Inflation handling decision:** Inflation is intentionally only applied to 5-year projection and retirement planner. Monthly/annual snapshot uses nominal returns. This was a deliberate decision — applying inflation to monthly interest income made it show $290 instead of $1,000, which was confusing because the bank actually deposits $1,000/month. Short-term planning should use real numbers; long-term projections use inflation-adjusted.

3. **Saved scenarios include the full expense model.** When a scenario is saved, it captures all recurring and one-time expenses (with mute states), not just the expense total. Loading a scenario replaces the entire expense model. This was a deliberate design choice so you can compare "current baseline" vs. "post-baby" with different expense line items.

4. **The compare table shows both income-only and full-picture rows** for cash flow and savings. This lets the user see "can my freelance income alone sustain this" vs. "what's the total picture with passive income."

5. **Light theme was attempted and reverted.** A full restyle to match Stint's warm cream aesthetic was tried and undone via git. The dark theme was preferred for a financial dashboard. Don't attempt to restyle to light unless explicitly asked.

6. **Mobile crashes have been caused by:** crypto.randomUUID() unavailability, IndexedDB returning undefined on fresh devices, and recursive uuid() fallback functions. Always validate IndexedDB reads, always use Math.random UUID fallback, always wrap risky code in error boundaries.

7. **The user's day rate of $1,200 is below market.** NYC freelance CD rate is $1,400-$1,600. This context matters for scenario presets and defaults.

8. **QBI (Qualified Business Income) deduction has been identified as applicable** but is NOT yet modeled in the tax estimation. It would reduce taxable freelance income by 20%. This is a planned enhancement.

9. **Advantage Savings account earns negligible interest** and is mapped to "checking" not "hys" in the planner variables. This is intentional — don't change it.

10. **Settings sync workflow:** PC is source of truth. Phone is for exploration. Push from PC, pull on phone. Phone changes are considered throwaway unless explicitly pushed. This is by design, not a limitation to fix.

11. **PWA icon should be dark circle with white serif "L"** matching the Stint app's "S" icon (dark circle, white serif letter). Current icon may be wrong — was showing "A" on phone.

12. **Prep2Print SQL should never be run in this project.** User was accidentally prompted with shot_cameras table creation from another project. Only `ledger_sync` is owned by Stint Ledger.

---
