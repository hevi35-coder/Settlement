import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Supabase Admin 클라이언트 (서버사이드 전용)
 * Service Role Key를 사용하여 RLS 우회 및 관리자 권한으로 데이터베이스 작업을 수행합니다.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * 공용 지출 데이터를 shared_expenses 테이블에 저장합니다.
 * 중복된 unique_hash가 있는 경우 업데이트하지 않고 무시합니다.
 *
 * @param userId - 사용자 ID
 * @param expensesData - 저장할 지출 데이터 배열
 * @returns 저장 결과 정보
 */
export async function saveExpensesToDB(
  userId: string,
  expensesData: Array<{
    date: string
    category: string
    content: string
    paymentMethod: string
    amount: number
    memo: string
    unique_hash: string
  }>
) {
  const dataToInsert = expensesData.map(expense => ({
    user_id: userId,
    expense_date: expense.date,
    category_main: expense.category,
    content: expense.content,
    amount: expense.amount,
    memo: expense.memo,
    payment_method: expense.paymentMethod,
    unique_hash: expense.unique_hash
  }))

  // upsert를 사용하여 중복 시 무시하고 새 데이터만 삽입
  const { data, error } = await supabaseAdmin
    .from('shared_expenses')
    .upsert(dataToInsert, {
      onConflict: 'user_id,unique_hash',
      ignoreDuplicates: true
    })
    .select('id, unique_hash')

  if (error) {
    console.error('Database save error:', error)
    throw new Error(`데이터베이스 저장 실패: ${error.message}`)
  }

  return {
    totalSubmitted: dataToInsert.length,
    newRecords: data?.length || 0,
    duplicatesIgnored: dataToInsert.length - (data?.length || 0)
  }
}