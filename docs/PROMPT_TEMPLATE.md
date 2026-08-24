# PROMPT TEMPLATE

모든 Task 파일(`tasks/*.md`)은 아래 구조를 따른다.

```
# ROLE

# OBJECTIVE

# CONTEXT

# REQUIREMENTS

# CONSTRAINTS

# ACCEPTANCE CRITERIA

# VALIDATION

# OUTPUT
```

- **ROLE**: 이 Task를 수행하는 Agent의 역할 (Development / Design / QA)
- **OBJECTIVE**: Task의 목표
- **CONTEXT**: 참고해야 할 문서 (PRD, PROJECT_RULES 등) 및 선행 작업
- **REQUIREMENTS**: 구현/검증해야 할 구체적 항목
- **CONSTRAINTS**: 해당 Agent가 지켜야 할 제약사항 (변경 금지 영역 포함)
- **ACCEPTANCE CRITERIA**: 완료로 판단할 기준
- **VALIDATION**: 완료 전 스스로 확인해야 할 절차 (git diff 검토, 실행 확인 등)
- **OUTPUT**: 결과물 (branch, commit message, report 등)
