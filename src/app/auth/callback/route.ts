import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 인증 성공 시 사용자 설정 확인 및 생성
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Settings 테이블에 사용자 설정이 있는지 확인
        const { data: settings } = await supabase
          .from('settings')
          .select('id')
          .eq('user_id', user.id)
          .single()

        // 설정이 없으면 기본 설정 생성
        if (!settings) {
          await supabase
            .from('settings')
            .insert({
              user_id: user.id,
              monthly_salary: 0,
              fixed_expenses: []
            })
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // 인증 실패 시 에러 페이지로 리다이렉트
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}