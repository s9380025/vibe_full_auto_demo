# ROLE
Design Agent

# OBJECTIVE
`feature/dev-001`이 main에 merge된 이후, 정상 동작하는 Tetris의 UI/UX를 개선한다.

# CONTEXT
먼저 아래 문서를 읽는다:
- `docs/PRD.md`
- `docs/PROJECT_RULES.md`
- `docs/PROMPT_TEMPLATE.md`
- `tasks/DESIGN-001.md` (본 문서)

Branch: `feature/design-001`

현재 `main`에는 Development Agent가 구현한 동작하는 Tetris 게임이 있다.

# REQUIREMENTS
- Board Layout 정리 (게임 영역 중앙 배치, Board와 정보 영역 명확히 구분)
- SCORE / LEVEL / LINES 표시 개선
- NEXT PIECE 표시 영역 구현/개선
- Tetromino 종류별 시각적 구분 (색상 등)
- START 화면 명확화
- GAME OVER 화면 명확화
- RESTART UI
- 전체적으로 단순하고 세련된 Arcade Game 스타일 적용 및 시각적 일관성 확보

# CONSTRAINTS
- **절대 조건: Game Logic을 변경하지 않는다.**
  - 이동, 회전, Collision, Line Clear, Score/Level 계산, Game Over 판정 로직 등을 수정하지 않는다.
- 가능하면 CSS/UI 중심으로 수정한다.
- JavaScript 변경이 필요하다면 UI 표현(예: Next Piece 렌더링, DOM 업데이트)에 필요한 최소 범위만 허용한다.
- PRD에 없는 기능을 임의로 추가하지 않는다.

# ACCEPTANCE CRITERIA
- PRD의 디자인 요구사항을 충족한다.
- 기존 Game Logic이 동일하게 동작한다 (Movement, Rotation, Collision, Line Clear, Score/Level, Game Over 모두 유지).

# VALIDATION
- 작업 완료 후 Game Logic 관련 코드에 의도치 않은 변경이 없는지 `git diff`로 확인한다.
- 주요 기능(이동/회전/드롭/라인클리어/스코어/게임오버/재시작)이 여전히 정상 동작하는지 논리적으로 재검토한다.

# OUTPUT
- Branch: `feature/design-001`
- Commit message: `style: improve tetris game UI`
- Push to origin
- Design 결과를 구조화하여 Main Agent에게 보고 (변경된 파일, Game Logic 미변경 확인 여부)
