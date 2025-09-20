# 데이터베이스 마이그레이션 가이드

## T-002: Supabase 데이터베이스 스키마 생성 완료

### 📋 생성된 마이그레이션 파일들

1. **002_shared_expenses_table.sql** - 공용지출 데이터 테이블
2. **003_calculation_history_table.sql** - 정산 이력 테이블
3. **004_update_settings_table.sql** - 설정 테이블 업데이트

### 🎯 테이블 구조

#### 1. shared_expenses (공용지출 원본 데이터)
```sql
- id: BIGINT (자동 증가)
- user_id: UUID (auth.users 참조)
- expense_date: DATE (지출 날짜)
- type: TEXT (지출 타입)
- category_main: TEXT (대분류)
- category_sub: TEXT (소분류)
- content: TEXT (지출 내용)
- amount: DECIMAL(12,2) (금액)
- memo: TEXT (메모)
- payment_method: TEXT (결제수단)
- unique_hash: TEXT (중복 방지용 해시)
- created_at, updated_at: TIMESTAMP
```

#### 2. calculation_history (정산 이력)
```sql
- id: BIGINT (자동 증가)
- user_id: UUID (auth.users 참조)
- confirmed_at: TIMESTAMP (확정 일시)
- salary_snapshot: DECIMAL(12,2) (월급 스냅샷)
- fixed_expense_snapshot: DECIMAL(12,2) (고정지출 스냅샷)
- shared_expense_total: DECIMAL(12,2) (공용지출 합계)
- final_transfer_amount: DECIMAL(12,2) (최종 이체액)
- details_snapshot: JSONB (상세 내역)
- period_start, period_end: DATE (정산 기간)
- created_at: TIMESTAMP
```

#### 3. settings (설정 테이블 업데이트)
```sql
기존 컬럼:
- id, user_id, created_at, updated_at

변경된 컬럼:
- monthly_salary → salary (DECIMAL)
- fixed_expenses → fixed_expense (JSONB → DECIMAL)

추가된 컬럼:
- period_start_day: INTEGER (정산 시작일)
- period_end_day: INTEGER (정산 종료일)
- zip_password: TEXT (뱅크샐러드 파일 비밀번호)
- default_period_months: INTEGER (기본 정산 기간)
```

### 🔐 RLS (Row Level Security) 정책

모든 테이블에 사용자별 데이터 격리 정책 적용:
- SELECT, INSERT, UPDATE, DELETE 모두 `auth.uid() = user_id` 조건
- 사용자는 자신의 데이터만 접근 가능

### 🚀 마이그레이션 실행 방법

#### Option 1: Supabase 대시보드 (권장)
1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택 → SQL Editor
3. 아래 순서대로 마이그레이션 파일 내용을 복사하여 실행:
   ```
   supabase/migrations/002_shared_expenses_table.sql
   supabase/migrations/003_calculation_history_table.sql
   supabase/migrations/004_update_settings_table.sql
   ```

#### Option 2: Supabase CLI (로컬 개발 시)
```bash
# CLI 설치 (필요시)
npm install -g supabase

# 프로젝트 연결
supabase login
supabase link --project-ref zepbcucpavsfffnkcimu

# 마이그레이션 실행
supabase db push
```

### ✅ 마이그레이션 검증

연결 테스트 스크립트 실행:
```bash
node scripts/test-db-connection.js
```

성공 시 출력:
```
✅ 기본 연결 성공
✅ Settings 테이블 접근 가능
✅ shared_expenses 테이블 접근 가능
✅ calculation_history 테이블 접근 가능
```

### 🔄 롤백 방법 (필요시)

테이블 삭제 순서 (의존성 고려):
```sql
DROP TABLE IF EXISTS public.calculation_history;
DROP TABLE IF EXISTS public.shared_expenses;
-- settings 테이블은 기존 컬럼 구조로 복원 필요
```

### 📝 다음 단계

T-002 완료 후 다음 작업:
- T-003: 파일 업로드 및 처리 API 구현
- T-004: 메인 대시보드 UI 구현
- T-005: 설정 페이지 구현

### 🔗 관련 문서

- [PRD 문서](../vooster-docs/prd.md)
- [기술 아키텍처](../vooster-docs/architecture.md)
- [단계별 개발 가이드](../vooster-docs/step-by-step.md)