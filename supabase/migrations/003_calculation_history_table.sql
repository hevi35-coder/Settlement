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