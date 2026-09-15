# How this was built with AI

This project was built with Claude Code over several sessions. Rather than a
transcript, this describes how the work was directed: the kinds of prompts
that drove each stage, the habits that kept quality up, and where human
judgement made the call. Prompts are paraphrased.

## The approach in brief

**Plan before code.** The first prompt handed over the full brief and asked
for a plan and repository structure only — no implementation — so the
architecture could be challenged while changing it was still free.

**Steer architecture early, in plain terms.** Design direction came as
intent rather than instructions: operations should be addable later without
touching existing code. The AI proposed how (a strategy registry behind a
single endpoint); the human agreed or redirected.

**See the design before building it.** A system-design diagram in the style
of an interview whiteboard was requested before any code, to check that the
layers and endpoints matched the intent.

**Constrain scope explicitly.** Feature breadth was ruled out up front in
favour of architecture, testing and deployability. Optional operations were
added later, deliberately, once the foundation was solid.

**Review, then choose.** Most of the later work came from asking for an audit
along a particular axis — reliability, observability, performance, testing,
design, SOLID. Each audit came back as a prioritised list with evidence, and
the human picked what to act on. Nothing in an audit was implemented until
it was chosen.

**Ask for evidence, not opinions.** Reviews were expected to measure: probing
the running API for edge cases, benchmarking before discussing performance,
measuring key geometry before calling the UI off. Several findings existed
only because something was measured rather than assumed.

**Fix bugs test-first, and prove the test.** Bugs were reproduced by a
failing test before being fixed, and new safety nets were checked by
temporarily breaking the code they guard — confirming each test catches the
bug it was written for rather than passing regardless.

**Keep trade-offs with the human.** Whenever a choice had genuine costs on
both sides, the AI laid out the options and a recommendation and asked,
rather than deciding silently. Those decisions are listed below.

**Separate advice from implementation.** Questions about whether an idea
suited the design got a recommendation and its trade-off, not code.

**Adopt selectively.** Later reviews were scoped down to changes that earn
their place by making the code cleaner or easier to extend, which kept
principle-driven refactoring from turning into ceremony.

**Verify every change end to end.** Each change ran through unit tests, the
real stack under Docker Compose, the browser suite, and CI before being
reported as done.

## How the work progressed

1. **Planning.** The brief, plus a request for a plan and a clean repository
   layout. Produced the layered backend, the single-endpoint API, and a commit
   strategy of small, meaningful commits.

2. **Architecture and visual design.** A push for extensibility led to the
   `Operation` interface and registry; a request for a diagram produced the
   architecture picture before implementation started.

3. **Build and first release.** Tooling was installed, then the backend, the
   frontend, containers, CI and documentation were built in order and pushed
   to GitHub. Two steering prompts shaped the UI: apply established UX laws
   (Hick's, Miller's, Fitts's) and keep it usable on phones. Setup that needed
   system-level changes, such as enabling WSL for Docker, was done by the
   human.

4. **First audit — correctness.** An open-ended review of everything built so
   far found an overflow that returned `200 OK` with an empty body, a quickstart
   whose CORS setup could never work, input silently lost mid-request, and an
   API client that trusted any response. All were fixed, along with request
   size limits, keyboard input, a Compose healthcheck and a licence.

5. **Extending the API.** Exponentiation, square root and percentage were
   added. Two ambiguities were put to the human rather than guessed: what `%`
   should mean, and where new keys should go without breaking the familiar
   keypad. Unary operations prompted an explicit arity on each operation.

6. **Second audit — UI/UX, architecture, testing, observability.** Found that
   a hung backend could trap the user with a dead keypad, and that nothing
   tested the frontend and backend against each other. Led to request
   deadlines and cancellation, a contract test against the real containers,
   CI safety nets, and observability: structured logs, request IDs, and
   metrics with deliberately bounded label cardinality.

7. **Performance and testing.** Performance was measured rather than
   debated — the server turned out to be orders of magnitude faster than the
   network, so nothing needed optimising. Testing grew instead: a fuzz target
   verified against the earlier overflow bug, direct tests for display
   formatting, and a Playwright suite, which caught a focus bug unit tests
   structurally could not on its first run.

8. **Design review.** Input handling was rebuilt as a pure state machine so
   that impossible states can't be represented, cancellation was unified onto
   a single mechanism, and render failures got an error boundary.

9. **Visual polish.** Measurement showed the "circular" keys were ellipses
   and the display had dead space. Both were fixed, and the display gained a
   line showing the calculation in progress without ever shifting the layout.

10. **Third audit.** That new expression line made a logic bug visible: an
    operator pressed after a unary result discarded the pending calculation.
    It was reproduced with a failing test, fixed by making the state machine
    distinguish two situations it had been conflating, and guarded against
    over-correction.

11. **Alerting — advice only.** Asked whether an alerting tool fitted the
    design, the answer was that the signals already existed but a full
    alerting stack would have no one to notify; nothing was added.

12. **SOLID pass.** A principles review was narrowed to changes that made the
    code genuinely cleaner or more extensible: a single operation table the
    compiler keeps complete, a narrow interface between API and domain, a
    smaller request handler, and a fix for a wrapper that hid capabilities of
    the object it wrapped.

13. **Documentation.** This file and the architecture diagram were brought up
    to date with the final code.

## Decisions made by the human

| Question | Options considered | Chosen |
|---|---|---|
| Operation design | One route per operation, or a registry behind one endpoint | Registry — new operations never touch the router or handler |
| Early scope | Optional operations up front, or foundation first | Foundation first; operations added later |
| What `%` means | Divide by 100, or "b percent of a" | Divide by 100, matching phone calculators |
| Where new keys go | A fifth keypad column, or a separate function row | Separate row, keeping the familiar layout |
| Metrics | Prometheus client, `expvar`, or logs only | Prometheus, the project's only third-party dependency |
| Browser tests | Stop at API-level contract tests, or add Playwright | Add Playwright |
| Alerting | Full stack, rules only, or nothing | Nothing — no one to notify for a local deployment |
| Principle-driven refactors | Apply everything, or only what earns its keep | Only what earns its keep |

## What the loop caught

Bugs found by the review-and-verify cycle rather than written knowingly into
the code:

- A numeric overflow answered with a successful but empty response.
- Local development instructions that could never have worked because of CORS.
- Keystrokes silently discarded while a request was in flight.
- A hung backend leaving every key disabled, including clear.
- A clicked key keeping focus and swallowing the next Enter — found by the
  browser suite on its first run.
- A pending calculation dropped when an operator followed a unary key —
  surfaced by the expression line added during visual polish.

## Tooling

Claude Code wrote the code, tests, Docker and CI configuration, and
documentation, and ran the builds, tests and git operations. The human set
direction, made the decisions above, and handled anything needing their own
accounts or system settings — GitHub authentication, and enabling WSL for
Docker.
