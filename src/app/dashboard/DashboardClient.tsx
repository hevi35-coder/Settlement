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
import { FileUpload } from '@/components/ui/file-upload'
import { ExpensesList } from '@/components/expenses/ExpensesList'
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
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const handleFileUpload = async (file: File) => {
    setUploadLoading(true)
    setUploadMessage('')
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // 기간 필터링 추가
      if (startDate) {
        formData.append('startDate', startDate)
      }
      if (endDate) {
        formData.append('endDate', endDate)
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (response.ok) {
        setUploadMessage('ZIP 파일이 성공적으로 처리되었습니다!')
        setUploadResult(result)
      } else {
        setUploadMessage(result.error || '파일 업로드 중 오류가 발생했습니다.')
      }
    } catch (error) {
      setUploadMessage('파일 업로드 중 오류가 발생했습니다.')
      console.error('업로드 오류:', error)
    } finally {
      setUploadLoading(false)
    }
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

      {/* ZIP 파일 업로드 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>가계부 ZIP 파일 업로드</CardTitle>
          <CardDescription>
            엑셀 가계부가 포함된 ZIP 파일을 업로드하여 정산을 시작하세요
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 기간 선택 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">시작 날짜 (선택사항)</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="시작 날짜"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">종료 날짜 (선택사항)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="종료 날짜"
              />
            </div>
          </div>

          {uploadMessage && (
            <Alert className={uploadMessage.includes('성공') ? 'border-green-500' : 'border-red-500'}>
              <AlertDescription>{uploadMessage}</AlertDescription>
            </Alert>
          )}

          <FileUpload
            onFileChange={handleFileUpload}
            accept=".zip"
            className="min-h-[150px] flex items-center justify-center"
          >
            <div className="text-center space-y-2">
              {uploadLoading ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-600">파일 처리 중...</p>
                </div>
              ) : (
                <>
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="text-sm font-medium">ZIP 파일을 선택하거나 드래그하세요</p>
                  <p className="text-xs text-gray-500">최대 10MB까지 지원</p>
                </>
              )}
            </div>
          </FileUpload>

          {uploadResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <h4 className="font-medium text-green-800 mb-2">처리 결과</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p>• 업로드된 파일: {uploadResult.uploadedFile}</p>
                <p>• 발견된 Excel 파일: {uploadResult.filesFound}개</p>
                <p>• 처리된 파일: {uploadResult.processedFiles?.length || 0}개</p>

                {uploadResult.processedFiles?.map((file: any, index: number) => (
                  <div key={index} className="mt-2 p-3 bg-white border border-green-300 rounded">
                    <p className="font-medium text-green-800">{file.fileName}</p>
                    <div className="mt-1 space-y-1 text-xs text-green-600">
                      <p>• 시트: {file.sheetName}</p>
                      <p>• 총 {file.totalRows}행 중 {file.validRows}행 처리됨</p>
                      {file.errors && file.errors.length > 0 && (
                        <p className="text-orange-600">• 오류: {file.errors.length}건</p>
                      )}
                      {file.summary && (
                        <div className="mt-2 space-y-1">
                          <p>• 총 금액: {file.summary.totalAmount?.toLocaleString()}원</p>
                          <p>• 카테고리: {file.summary.categories?.join(', ')}</p>
                          <p>• 결제수단: {file.summary.paymentMethods?.join(', ')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      {/* 지출 내역 조회 */}
      <Card>
        <CardHeader>
          <CardTitle>지출 내역 조회</CardTitle>
          <CardDescription>저장된 지출 내역을 기간별로 조회할 수 있습니다</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpensesList
            initialStartDate={startDate || undefined}
            initialEndDate={endDate || undefined}
            showDateFilter={true}
            limit={50}
          />
        </CardContent>
      </Card>
    </>
  )
}