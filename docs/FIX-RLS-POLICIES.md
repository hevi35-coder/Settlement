# 🔧 RLS 정책 수정 가이드

## 현재 문제
- ❌ 익명 사용자가 shared_expenses 테이블에 접근 가능
- ❌ RLS 정책이 올바르게 작동하지 않음

## 🔴 즉시 수정 필요 (Supabase 대시보드 SQL Editor)

### 1. 기존 정책 삭제 및 재생성

```sql
-- 기존 정책들 모두 삭제
DROP POLICY IF EXISTS "Users can view their own shared expenses" ON public.shared_expenses;
DROP POLICY IF EXISTS "Users can insert their own shared expenses" ON public.shared_expenses;
DROP POLICY IF EXISTS "Users can update their own shared expenses" ON public.shared_expenses;
DROP POLICY IF EXISTS "Users can delete their own shared expenses" ON public.shared_expenses;

-- RLS 비활성화 후 재활성화
ALTER TABLE public.shared_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_expenses ENABLE ROW LEVEL SECURITY;

-- 새로운 정책 생성 (더 엄격하게)
CREATE POLICY "authenticated_users_select_own_expenses" ON public.shared_expenses
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "authenticated_users_insert_own_expenses" ON public.shared_expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_users_update_own_expenses" ON public.shared_expenses
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_users_delete_own_expenses" ON public.shared_expenses
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
```

### 2. calculation_history 테이블도 동일하게 수정

```sql
-- 기존 정책들 모두 삭제
DROP POLICY IF EXISTS "Users can view their own calculation history" ON public.calculation_history;
DROP POLICY IF EXISTS "Users can insert their own calculation history" ON public.calculation_history;
DROP POLICY IF EXISTS "Users can update their own calculation history" ON public.calculation_history;
DROP POLICY IF EXISTS "Users can delete their own calculation history" ON public.calculation_history;

-- RLS 비활성화 후 재활성화
ALTER TABLE public.calculation_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_history ENABLE ROW LEVEL SECURITY;

-- 새로운 정책 생성
CREATE POLICY "authenticated_users_select_own_history" ON public.calculation_history
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "authenticated_users_insert_own_history" ON public.calculation_history
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_users_update_own_history" ON public.calculation_history
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_users_delete_own_history" ON public.calculation_history
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
```

### 3. settings 테이블 정책도 확인

```sql
-- settings 테이블의 기존 정책 확인 및 수정
DROP POLICY IF EXISTS "Users can view their own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON public.settings;
DROP POLICY IF EXISTS "Users can delete their own settings" ON public.settings;

-- settings 테이블 새 정책
CREATE POLICY "authenticated_users_select_own_settings" ON public.settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "authenticated_users_insert_own_settings" ON public.settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_users_update_own_settings" ON public.settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "authenticated_users_delete_own_settings" ON public.settings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
```

## 🔍 수정 후 검증

터미널에서 실행:
```bash
node scripts/verify-migration.js
```

성공 시 예상 출력:
```
✅ RLS 정책이 올바르게 작동 중 (익명 접근 차단)
```

## 📝 수정 내용 요약

### 변경 사항
1. **TO authenticated** 추가 - 인증된 사용자만 접근 가능
2. **WITH CHECK** 절 추가 - INSERT/UPDATE 시 추가 검증
3. **정책명 명확화** - 더 명확한 정책 이름 사용

### 보안 강화
- 익명 사용자 완전 차단
- 인증된 사용자만 자신의 데이터 접근 가능
- 이중 검증 (USING + WITH CHECK)