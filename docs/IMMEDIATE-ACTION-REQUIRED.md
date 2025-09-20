# 🚨 즉시 실행 필요: T-002 마이그레이션

## 현재 상태
- ✅ Settings 테이블: 정상 작동
- ❌ shared_expenses 테이블: **생성되지 않음**
- ❌ calculation_history 테이블: **생성되지 않음**

## 📋 실행 단계 (순서대로)

### 1. Supabase 대시보드 접속
```
https://supabase.com/dashboard/project/zepbcucpavsfffnkcimu
→ SQL Editor 클릭
```

### 2. 첫 번째 마이그레이션 실행
**파일:** `supabase/migrations/002_shared_expenses_table.sql`

```sql
-- 공용지출 원본 데이터 테이블 생성
CREATE TABLE IF NOT EXISTS public.shared_expenses (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    expense_date DATE NOT NULL,
    type TEXT,
    category_main TEXT,
    category_sub TEXT,
    content TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    memo TEXT,
    payment_method TEXT,
    unique_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, unique_hash) -- 사용자별 중복 방지
);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 지출 내역만 조회 가능
CREATE POLICY "Users can view their own shared expenses" ON public.shared_expenses
    FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 지출 내역만 삽입 가능
CREATE POLICY "Users can insert their own shared expenses" ON public.shared_expenses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 지출 내역만 업데이트 가능
CREATE POLICY "Users can update their own shared expenses" ON public.shared_expenses
    FOR UPDATE USING (auth.uid() = user_id);

-- 사용자는 자신의 지출 내역만 삭제 가능
CREATE POLICY "Users can delete their own shared expenses" ON public.shared_expenses
    FOR DELETE USING (auth.uid() = user_id);

-- updated_at 트리거 생성
CREATE TRIGGER handle_shared_expenses_updated_at
    BEFORE UPDATE ON public.shared_expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS shared_expenses_user_id_idx ON public.shared_expenses(user_id);
CREATE INDEX IF NOT EXISTS shared_expenses_date_idx ON public.shared_expenses(expense_date);
CREATE INDEX IF NOT EXISTS shared_expenses_user_date_idx ON public.shared_expenses(user_id, expense_date);
```

### 3. 두 번째 마이그레이션 실행
**파일:** `supabase/migrations/003_calculation_history_table.sql`

```sql
-- 정산 이력 요약 테이블 생성
CREATE TABLE IF NOT EXISTS public.calculation_history (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    salary_snapshot DECIMAL(12,2) NOT NULL,
    fixed_expense_snapshot DECIMAL(12,2) NOT NULL,
    shared_expense_total DECIMAL(12,2) NOT NULL,
    final_transfer_amount DECIMAL(12,2) NOT NULL,
    details_snapshot JSONB NOT NULL, -- 정산에 포함된 상세 내역 (수정된 메모 포함)
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.calculation_history ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 정산 이력만 조회 가능
CREATE POLICY "Users can view their own calculation history" ON public.calculation_history
    FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 정산 이력만 삽입 가능
CREATE POLICY "Users can insert their own calculation history" ON public.calculation_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 정산 이력만 업데이트 가능
CREATE POLICY "Users can update their own calculation history" ON public.calculation_history
    FOR UPDATE USING (auth.uid() = user_id);

-- 사용자는 자신의 정산 이력만 삭제 가능
CREATE POLICY "Users can delete their own calculation history" ON public.calculation_history
    FOR DELETE USING (auth.uid() = user_id);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS calculation_history_user_id_idx ON public.calculation_history(user_id);
CREATE INDEX IF NOT EXISTS calculation_history_confirmed_at_idx ON public.calculation_history(confirmed_at);
CREATE INDEX IF NOT EXISTS calculation_history_user_confirmed_idx ON public.calculation_history(user_id, confirmed_at DESC);
```

### 4. 세 번째 마이그레이션 실행
**파일:** `supabase/migrations/004_update_settings_table.sql`

```sql
-- Settings 테이블 구조를 PRD 스펙에 맞게 업데이트

-- 기존 컬럼명 변경 및 타입 조정
ALTER TABLE public.settings
RENAME COLUMN monthly_salary TO salary;

-- fixed_expenses 컬럼을 DECIMAL 타입으로 변경
-- 기존 JSONB 타입이었으므로 새 컬럼을 추가하고 기존 컬럼을 삭제
ALTER TABLE public.settings
ADD COLUMN fixed_expense DECIMAL(12,2) DEFAULT 0;

-- 기존 fixed_expenses 컬럼 삭제 (JSONB → DECIMAL 변경)
ALTER TABLE public.settings
DROP COLUMN IF EXISTS fixed_expenses;

-- 데이터 수집 기간 설정을 위한 컬럼 추가
ALTER TABLE public.settings
ADD COLUMN period_start_day INTEGER DEFAULT 1 CHECK (period_start_day >= 1 AND period_start_day <= 31),
ADD COLUMN period_end_day INTEGER DEFAULT 31 CHECK (period_end_day >= 1 AND period_end_day <= 31);

-- 설정 정보를 더 명확하게 하기 위한 추가 컬럼
ALTER TABLE public.settings
ADD COLUMN zip_password TEXT, -- 뱅크샐러드 zip 파일 비밀번호
ADD COLUMN default_period_months INTEGER DEFAULT 1 CHECK (default_period_months >= 1 AND default_period_months <= 12);

-- 인덱스 정리 (기존 인덱스는 유지)
-- settings_user_id_idx는 이미 존재함
```

### 5. 검증 실행
마이그레이션 완료 후:
```bash
node scripts/verify-migration.js
```

성공 시 예상 출력:
```
✅ settings 테이블 존재
✅ shared_expenses 테이블 존재
✅ calculation_history 테이블 존재
🎉 모든 검증 통과!
```

## ⚠️ 주의사항
1. **순서대로 실행**: 002 → 003 → 004 순서 지킬 것
2. **에러 발생 시**: 에러 메시지 확인 후 다시 시도
3. **백업**: 중요한 데이터가 있다면 먼저 백업

## 🔄 다음 단계
마이그레이션 검증 완료 후 → T-003 파일 업로드 API 구현 진행