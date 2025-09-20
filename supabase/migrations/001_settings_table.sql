-- Settings 테이블 생성 (월급 및 고정지출 설정)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    monthly_salary DECIMAL(12,2) DEFAULT 0,
    fixed_expenses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 설정만 조회 가능
CREATE POLICY "Users can view their own settings" ON public.settings
    FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 설정만 삽입 가능
CREATE POLICY "Users can insert their own settings" ON public.settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 설정만 업데이트 가능
CREATE POLICY "Users can update their own settings" ON public.settings
    FOR UPDATE USING (auth.uid() = user_id);

-- 사용자는 자신의 설정만 삭제 가능
CREATE POLICY "Users can delete their own settings" ON public.settings
    FOR DELETE USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at 트리거 생성
CREATE TRIGGER handle_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS settings_user_id_idx ON public.settings(user_id);