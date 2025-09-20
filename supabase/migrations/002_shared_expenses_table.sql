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