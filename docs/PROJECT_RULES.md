# PROJECT RULES

이 문서는 `vibe_full_auto_demo` 프로젝트에 참여하는 모든 Agent(Main, Development, Design, QA/Test)가 공통으로 따라야 하는 규칙이다.

## 1. PRD 우선
- `docs/PRD.md`는 Single Source of Truth다.
- 모든 구현/디자인/검증은 PRD를 기준으로 판단한다.
- PRD에 없는 기능은 임의로 추가하지 않는다.

## 2. 최소 변경
- 요청된 범위를 벗어나는 리팩토링이나 재작성을 하지 않는다.
- 기존에 정상 동작하는 기능은 보호를 최우선으로 한다.

## 3. 기존 기능 보호
- 새로운 기능 구현보다 기존 정상 기능 보호를 우선한다.
- 기존 기능을 삭제하거나 임의로 변경하지 않는다.

## 4. Agent 역할 분리
- **Development Agent**: Core Game Logic 구현. 디자인 임의 변경 최소화.
- **Design Agent**: UI/UX 개선. Game Logic 변경 금지. JS 수정은 디자인에 필요한 최소 범위만 허용.
- **QA/Test Agent**: PRD 기준 독립 검증. 제품 Source 직접 수정 금지.

## 5. Git Branch
- 각 Agent의 작업은 별도 Branch에서 수행한다.
  - `feature/dev-001`
  - `feature/design-001`
  - `fix/FIX-XXX` (Fail 수정 시)
- Main Agent가 검토한 후에만 `main`에 Merge한다.

## 6. Commit
- 모든 중요한 변경은 Git Commit으로 남긴다.
- Commit 전 반드시 `git diff`로 변경 내용을 검토한다.

## 7. QA 독립성
- QA Agent는 Development/Design Agent의 완료 보고를 신뢰하지 않고 PRD 기준으로 독립 검증한다.
- QA Agent는 제품 Source를 직접 수정하지 않는다.

## 8. Regression Test
- Design 적용, Fix 적용 이후에는 반드시 기존 Core Game Logic 전체에 대한 Regression Test를 수행한다.

## 9. FAIL Feedback Loop
- QA FAIL은 Main Agent가 원인을 분석하여 담당 Agent에게 Fix Task로 반환한다.
- 동일 FAIL에 대한 자동 수정은 최대 2회까지만 수행한다.
- 2회 수정 후에도 FAIL이면 최종 결과를 `HOLD`로 처리한다.
- 이미 PASS한 기능은 Fix 과정에서 임의로 변경하지 않는다.

## 10. Force Push 금지
- force push를 사용하지 않는다.
- main branch에 대한 destructive 변경을 하지 않는다.
- 기존 Repository의 파일을 임의 삭제하지 않는다.

## 11. 공통 실행 원칙
- 사용자의 중간 개입 없이 진행 가능한 작업은 스스로 판단하여 계속 진행한다.
- 인증 실패, 권한 부족 등 스스로 해결할 수 없는 외부 Blocker 발생 시에만 중단하고 보고한다.
- 각 단계의 결과는 GitHub Issue 또는 Markdown Report로 남긴다.
