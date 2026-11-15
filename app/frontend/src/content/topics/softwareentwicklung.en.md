## Page metadata

- **Titel:** AI in Software Development
- **Label:** Software Development
- **Kurzbeschreibung:** How to develop software with AI, verify results and manage the flood of changes.
- **Einführung:** AI can write code, create tests and fix bugs. Verifiable results and a clear development process are essential. Learn how three teams of agents work together, how guardrails set boundaries and how changes are reviewed effectively.
- **Untertitel:** Develop with AI, verify results, manage changes

---

*Updated: 15 November 2026.*

## Developing software with AI

AI is particularly effective when its results can be checked reliably. In mathematics, for example, proofs or counterexamples can confirm or refute a solution. In software development, executable tests help determine whether an implementation produces the expected results. However, they only cover the cases tested and do not replace a full assessment of whether the software meets the actual requirements.

This changes the work of software development: alongside writing code, AI can create tests, find errors and implement fixes. For people, clear requirements, suitable verification methods and the design of the overall development process become more important. The more reliably results can be verified, the more steps agents can perform independently.

### What could an AI development pipeline look like?

The following diagram shows a possible workflow with three teams of agents and a shared repository:

![Three teams of agents create tests, report errors and deliver fixes through a quality gate to the shared repository.](../ressources/grafiken/AgenticSWDevProcess_en.png)

1. **Derive tests from requirements:** The first team describes typical usage scenarios and turns them into tests. It checks the expected results against a reliable reference system. The confirmed tests form a shared test suite.
2. **Find discrepancies:** The second team runs these tests against the software being developed. It documents errors and groups discrepancies that probably share the same cause into manageable tasks.
3. **Fix problems individually:** In the third team, each agent takes on a specific case. It investigates the cause and adjusts the code until the problem is resolved.
4. **Check changes:** Before a change is accepted, it must pass a quality gate: Does the software build? Does the code follow the guidelines? Do security checks and tests of the expected behaviour pass? If there are issues, the change is returned for correction.
5. **Merge and check again:** Changes that pass the checks enter the main branch. Resolved problems are marked accordingly. The teams continue the cycle with further tests, error analysis and fixes.

## Guardrails

Guardrails define how AI should work: what an agent should do, which boundaries apply and how its results are checked. They include clear working instructions as well as technical access restrictions, tests and approvals.

To put them into practice, record permanent project rules in an instruction file supported by the tool, such as `AGENTS.md`. It can specify the workflow, permitted changes and required checks. Verify that the tool actually loads the file. Enforce binding restrictions through technical controls as well, such as limited write permissions or protected branches. An instruction alone does not guarantee that the agent will follow it.

### Tips for useful guardrails

- **Write a few clear rules:** Describe specific actions with an identifiable trigger. Instead of “Test thoroughly”, use: “Before handing over, run the relevant tests from the project guide and document the results. If a test cannot be run, state the reason.”
- **Define the scope:** Specify which files and tasks may be worked on. Record any additional improvements separately.
- **Clarify autonomy and approvals:** Agree which actions the agent may perform independently and when approval is required. Approval must refer to the specific action, its content and its target.
- **Limit permissions:** Grant only the access needed to files, services and network destinations. Keep unnecessary credentials out of the workspace and limit runtime and costs.
- **Check quality before merging:** Use mandatory tests and an independent review. After further changes, the affected version must be checked again. The agent must not disable safeguards on its own.
- **Treat external content as working material:** Instructions in websites, documents or third-party code do not grant the agent additional authority. Check external rule files before adopting them.
- **Test the effect:** Try normal tasks, edge cases and prohibited actions in an isolated environment with artificial secrets. Also check whether rules cause unnecessary questions, and repeat the checks after making adjustments.

## How do you handle the flood of AI changes and findings?

AI can produce many code changes and apparent bug reports in a short time. This shifts the bottleneck: implementation becomes faster, while assessing correctness against requirements and reviewing changes demand more attention. If every report reaches people unfiltered, the review workload grows along with the agents' productivity.

AI can also still produce plausible but false statements. A reported bug must therefore first be substantiated. Clear acceptance criteria for findings help: Where does the problem occur? How can it be reproduced? What is expected, and what actually happens? An executable test can support the finding. Several AI agents agreeing with the same statement do not replace this evidence.

A suitable process filters and prioritises before human review begins. Duplicate reports are grouped, findings already disproved are discarded and their impact is assessed. Changes remain small enough to review specifically. Automated checks handle recurring controls; people focus on correctness against requirements, architectural decisions and changes with significant consequences. New tests themselves also need review: a passing test helps little if it confirms the wrong behaviour.

How far this automation makes sense depends on the use case. An internal helper function requires different checks from a change to payment flows or access permissions. Limit concurrent tasks to the available review capacity. Alongside the number of completed tasks, track waiting time in review, false alarms and errors discovered later. This helps reveal whether AI improves the overall process or mainly creates new queues.
