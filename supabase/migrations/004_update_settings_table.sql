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