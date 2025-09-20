'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { User } from '@supabase/supabase-js'

interface Settings {
  id: string
  user_id: string
  monthly_salary: number
  fixed_expenses: any[]
  created_at: string
  updated_at: string
}

interface DashboardClientProps {
  user: User
  initialSettings: Settings | null
}

export default function DashboardClient({ user, initialSettings }: DashboardClientProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [monthlySalary, setMonthlySalary] = useState(
    initialSettings?.monthly_salary?.toString() || '0'
  )
  const [newExpense, setNewExpense] = useState({ name: '', amount: '' })
  const [fixedExpenses, setFixedExpenses] = useState<Array<{ name: string; amount: number }>>(
    initialSettings?.fixed_expenses || []
  )
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const addExpense = () => {
    if (newExpense.name && newExpense.amount) {
      const expense = {
        name: newExpense.name,
        amount: parseFloat(newExpense.amount)
      }
      setFixedExpenses([...fixedExpenses, expense])
      setNewExpense({ name: '', amount: '' })
    }
  }

  const removeExpense = (index: number) => {
    setFixedExpenses(fixedExpenses.filter((_, i) => i !== index))
  }

  const saveSettings = async () => {
    setLoading(true)
    setMessage('')

    try {
      const settingsData = {
        user_id: user.id,
        monthly_salary: parseFloat(monthlySalary) || 0,
        fixed_expenses: fixedExpenses
      }

      const { error } = await supabase
        .from('settings')
        .upsert(settingsData, {
          onConflict: 'user_id'
        })

      if (error) {
        setMessage('설정 저장 중 오류가 발생했습니다: ' + error.message)
      } else {
        setMessage('설정이 성공적으로 저장되었습니다!')
        // 설정 새로고침
        const { data } = await supabase
          .from('settings')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setSettings(data)
      }
    } catch (err) {
      setMessage('설정 저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const totalFixedExpenses = fixedExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  const remainingAmount = parseFloat(monthlySalary) - totalFixedExpenses

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">대시보드</h1>
          <p className="text-gray-600">안녕하세요, {user.email}님!</p>
        </div>
        <Button variant="outline" onClick={handleLogout}>
          로그아웃
        </Button>
      </div>

      {message && (
        <Alert className={message.includes('성공') ? 'border-green-500' : 'border-red-500'}>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* 월급 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>월급 설정</CardTitle>
            <CardDescription>매월 받는 급여를 입력하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="salary">월급 (원)</Label>
              <Input
                id="salary"
                type="number"
                placeholder="3,000,000"
                value={monthlySalary}
                onChange={(e) => setMonthlySalary(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* 고정지출 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>고정지출 관리</CardTitle>
            <CardDescription>매월 나가는 고정 지출을 관리하세요</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="지출 항목 (예: 월세)"
                value={newExpense.name}
                onChange={(e) => setNewExpense({ ...newExpense, name: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="금액"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                />
                <Button onClick={addExpense} size="sm">
                  추가
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {fixedExpenses.map((expense, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{expense.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{expense.amount.toLocaleString()}원</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeExpense(index)}
                    >
                      삭제
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 요약 정보 */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>월말정산 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-600">월급</p>
              <p className="text-2xl font-bold text-blue-600">
                {parseFloat(monthlySalary).toLocaleString()}원
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">고정지출 합계</p>
              <p className="text-2xl font-bold text-red-600">
                {totalFixedExpenses.toLocaleString()}원
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">남은 금액</p>
              <p className={`text-2xl font-bold ${remainingAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {remainingAmount.toLocaleString()}원
              </p>
            </div>
          </div>
          <Separator />
          <Button
            onClick={saveSettings}
            disabled={loading}
            className="w-full"
          >
            {loading ? '저장 중...' : '설정 저장'}
          </Button>
        </CardContent>
      </Card>
    </>
  )
}