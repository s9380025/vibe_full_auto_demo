# PRD: Tetris Mini Game

## Project
Tetris Mini Game

## 목적
- 웹 브라우저에서 실행되는 간단한 Tetris 게임 개발
- Main Agent가 3개의 전문 Sub Agent(Development, Design, QA/Test)를 통제하는
  완전 자동 Agentic Software Engineering Process를 검증한다.

## 핵심 기능
1. START 버튼으로 게임 시작
2. 10 x 20 Game Board
3. 기본 7종 Tetromino 지원 (I, O, T, S, Z, J, L)
4. Piece 자동 낙하
5. 좌/우 방향키 이동
6. 아래 방향키 Soft Drop
7. 위 방향키 Piece 회전
8. Space Bar Hard Drop
9. Board 경계 및 기존 Block Collision
10. 한 줄이 완성되면 Line 제거
11. Line 제거 시 Score 증가
12. 일정 Line 제거 시 Level 증가
13. Level 증가에 따라 낙하 속도 증가
14. Next Piece 표시
15. 더 이상 Piece를 배치할 수 없으면 GAME OVER
16. RESTART 기능

## 디자인 요구사항
- 게임 영역 중앙 배치
- Board와 정보 영역 명확히 구분
- SCORE / LEVEL / LINES 표시
- NEXT PIECE 표시
- Tetromino 종류를 쉽게 구분
- START / GAME OVER 상태 명확히 표현
- 단순하고 세련된 Arcade Game 스타일

## 기술 요구사항
- HTML
- CSS
- Vanilla JavaScript
- Backend 없음
- 외부 Library 사용 안 함
- 별도 Build 없이 브라우저 실행 가능

## Acceptance Criteria
- 각 핵심 기능이 정상 동작해야 한다.
- Design 적용 이후에도 기존 Game Logic이 유지되어야 한다.
- 최종 QA Functional / Design / Regression 결과가 모두 PASS여야 한다.

## 공통 Constraint
- PRD에 없는 기능 임의 추가 금지
- 기존 정상 기능 삭제 금지
- Agent별 변경 범위 준수
- Design Agent의 Game Logic 변경 금지
- QA Agent의 제품 Source 직접 수정 금지
- force push 금지
- main branch destructive 변경 금지
- 변경 전후 Git Diff 검토
- 테스트 실패를 숨기거나 PASS로 처리 금지

---

"PRD is the Single Source of Truth shared by all agents."
