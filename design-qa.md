# Design QA: 개인 일정 관리

## Setup

- reference: `C:\Users\user\AppData\Local\Temp\codex-clipboard-f6e1bc7c-764b-4c47-b2d7-04316b921106.jpg`
- implementation capture: `artifacts/personal-planner-implementation.png`
- capture size: 1265 × 1957 px, full-page desktop view
- state: 일정 입력과 업무 입력을 동시에 펼치고 현실적인 예시 값을 채운 상태
- runtime: Next.js development render using the production component styles; the deployed authenticated route was also verified to build and respond, but redirected the isolated QA browser to login as expected

## Full-view comparison

- Header hierarchy matches the sketch: page title and date navigation on the left, two green add buttons on the right.
- Content order matches the sketch: schedule block, task block, then an always-visible personal memo block.
- Schedule and task inputs are grouped into clearly bounded cards, preserving the hand-drawn block structure while using the existing product design system.
- The personal memo remains open by default and uses a vertically resizable textarea.
- Spacing, borders, radii, typography, and button styles are visually consistent with the rest of the application.

## Focused checks

- Schedule block includes category, title, start/end date-time, detail, memo, importance, weekly/monthly visibility, and all-day controls.
- Task block includes title, memo, start/deadline, detail, importance, weekly/monthly visibility, all-day, and completion controls.
- Schedule and task add links can coexist through the `new=schedule,task` query state, so both blocks can remain expanded as shown in the reference.
- Saved entries retain edit, delete, display-status, importance, and task-completion controls.
- No clipping, horizontal overflow, broken alignment, or cropped controls were observed in the full-page capture.

## Verification history

1. Compared the original handwritten reference and the first implementation capture in the same visual review input.
2. Adjusted the task add button to the same green primary treatment as the schedule add button.
3. Updated add/close query-state handling so schedule and task forms can be open simultaneously.
4. Rechecked the complete source structure against the final implementation capture.

final result: passed
