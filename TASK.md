# Publish Taiwan 2027

Owner: this main session, using the independently authorized GitHub account ivyjoycedegracia-pixel.
Integration base: f55e7ef38340e587c6f909c8e58f9551272e5670 on main.
Candidate: feature/publish-taiwan-2027. Next checkpoint: fresh independent GPT-6.1 Sol high review of the exact base/head, then merge and anonymous deployment verification.

Outcome: anyone with a shared HTTPS link can view the daily itinerary and budget without signing in, downloading files, or depending on the Mac.

Preserve: the two reviewed standalone HTML pages, all budget calculations, 5/7-person comparisons, dates, transport disclosures and inter-page navigation. Only two Taichung nights Jan29/30; both Ximending tours remain Jan25/28; no Chiayi overnight.

Scope: publish the existing reviewed pages, add a root landing redirect and static hosting markers, enable GitHub Pages on main. Do not publish local generators, temporary files, account material, or additional spreadsheet data.

Proof: prior artifact verification passed 54 budget checks and 15 itinerary checks at 375px and 728px. Verify published file hashes against the supplied artifacts, unauthenticated HTTPS access to both pages, the landing redirect, relative navigation, budget controls, collapsed transport disclosures and the exact accepted commit.

Recovery: disable GitHub Pages or revert the publishing commit. Static site has no backend or shared editable state. No checks were configured on this newly created repository at task start.

## Clickable daily amounts

Owner: main session. Integration base: 2064b92ca92cf7007afd669338261d4ec49337be. Candidate: feature/summary-cost-breakdowns. Next checkpoint: focused interaction checks, then fresh independent GPT-6.1 Sol high review bound to the final base/head before merge.

Observable outcome: selecting any 5-person or 7-person daily amount on the summarized itinerary opens an accessible, dismissible breakdown for that exact date and group size. Show the underlying per-person costs, their original currency / quote basis, and a subtotal equal to the selected displayed amount. Preserve query-selected budget options, all prices and calculations, transport disclosures, dates, two Taichung nights, no Chiayi stay and public page URLs.

Implementation direction: use an in-page native dialog, driven by the existing calculate() model. Native buttons provide keyboard access. Verify opening both group sizes across dates, changed budget options, exact item sums, close / Escape / backdrop dismissal, focus restoration, and small-screen layout. Reuse existing full budget evidence; check the unaffected budget page for regressions from shared rendering code. Publish only the two generated HTML pages plus this review record; local generation inputs remain outside the public source change.

Focused verification: 97 initial dialog / model checks passed at 375px and 728px, plus focus restoration and 4 changed-choice cases at each width. All 22 amount buttons show the correct day, group size, line items and exact two-decimal subtotal. Shared-price division, close button, cancel/Escape handler and backdrop dismissal passed. Native modal focus behavior and small-screen bounds were checked. Five shared-budget regression checks passed, including unchanged baseline totals, option changes and reset. No prices, source budget data or travel dates changed.
