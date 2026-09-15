# AI prompts used

This project was built with Claude Code. The prompts below are the actual
instructions given, in order, as required by the assignment.

1. **Initial brief** — the full assignment description (full-stack calculator,
   React + TS frontend, Go backend, REST API, unit tests, README, optional
   Docker), plus: "We are going to build this plan me a way, create the
   folders we need to keep a clean github usage as well plan everything."

2. *(after reviewing the first draft plan)* — "looks good but in the backend
   we want it to be extendable to other operations in the future so using
   something like strategy pattern is a good idea here"
   → led to redesigning the backend's domain layer around an `Operation`
   interface + `Registry`, and collapsing the API to a single generic
   `/api/v1/calculate` endpoint that reflects the registry.

3. — "looks good I also want you to draw a sketch similar to in
   hellointerview system design website, where it shows the service, api
   layer, api endpoints, frontend and our architecture entities etc in detail
   so we have a visual system design before start"
   → produced the Mermaid architecture diagram included in the plan and in
   this README.

4. — "use this email yb.saatchi@gmail.com for github"
   → set as the `git config user.email` for all commits.

5. — "for front end make sure we are enforcing ui ux laws like hicks law
   millers law fittslaw etc, also we want it to still look decent in mobile"
   → led to: thousands-grouping in the display (Miller's Law), touch-target
   sizing and focus-visible states (Fitts's Law), and responsive
   `clamp()`/breakpoint CSS for phone widths.

6. — "ok i installed wsl should I restart" / "okay lets continue"
   → routine back-and-forth while enabling WSL2 for Docker Desktop (a system
   feature change the user had to perform themselves) and resuming work
   afterward.

No other tools generated code in this project; all backend, frontend, test,
Docker, and CI files were written by Claude Code directly against the prompts
above.
