import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      )
    }

    // 쿼리 파라미터 추출
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    // 쿼리 빌더 시작
    let query = supabase
      .from('shared_expenses')
      .select(`
        id,
        expense_date,
        category_main,
        content,
        amount,
        memo,
        payment_method,
        created_at
      `)
      .eq('user_id', user.id)
      .order('expense_date', { ascending: false })

    // 기간 필터링 적용
    if (startDate) {
      query = query.gte('expense_date', startDate)
    }

    if (endDate) {
      query = query.lte('expense_date', endDate)
    }

    // 페이지네이션 적용
    query = query.range(offset, offset + limit - 1)

    // 쿼리 실행
    const { data: expenses, error: queryError } = await query

    if (queryError) {
      console.error('Database query error:', queryError)
      return NextResponse.json(
        { error: '데이터 조회 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }

    // 총 개수 조회 (페이지네이션을 위한)
    let countQuery = supabase
      .from('shared_expenses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (startDate) {
      countQuery = countQuery.gte('expense_date', startDate)
    }

    if (endDate) {
      countQuery = countQuery.lte('expense_date', endDate)
    }

    const { count, error: countError } = await countQuery

    if (countError) {
      console.error('Count query error:', countError)
    }

    // 요약 정보 계산
    const totalAmount = expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0
    const categories = [...new Set(expenses?.map(expense => expense.category_main).filter(Boolean))]
    const paymentMethods = [...new Set(expenses?.map(expense => expense.payment_method).filter(Boolean))]

    // 날짜 범위 계산
    const dateRange = expenses && expenses.length > 0 ? {
      earliest: expenses[expenses.length - 1]?.expense_date,
      latest: expenses[0]?.expense_date
    } : null

    return NextResponse.json({
      success: true,
      data: expenses || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      },
      summary: {
        totalAmount,
        totalCount: expenses?.length || 0,
        dateRange,
        categories,
        paymentMethods
      },
      filters: {
        startDate,
        endDate,
        userId: user.id
      }
    })

  } catch (error) {
    console.error('Expenses API error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}