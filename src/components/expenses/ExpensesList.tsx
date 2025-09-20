'use client'

import { useState } from 'react'
import { useExpenses, type Expense } from '@/hooks/useExpenses'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CalendarIcon, FilterIcon, RefreshCwIcon } from 'lucide-react'

interface ExpensesListProps {
  initialStartDate?: string
  initialEndDate?: string
  showDateFilter?: boolean
  limit?: number
}

export function ExpensesList({
  initialStartDate,
  initialEndDate,
  showDateFilter = true,
  limit = 50
}: ExpensesListProps) {
  const [startDate, setStartDate] = useState(initialStartDate || '')
  const [endDate, setEndDate] = useState(initialEndDate || '')
  const [appliedFilters, setAppliedFilters] = useState({
    startDate: initialStartDate,
    endDate: initialEndDate
  })

  const {
    data: expensesData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useExpenses({
    startDate: appliedFilters.startDate,
    endDate: appliedFilters.endDate,
    limit
  })

  const handleApplyFilters = () => {
    setAppliedFilters({
      startDate: startDate || undefined,
      endDate: endDate || undefined
    })
  }

  const handleClearFilters = () => {
    setStartDate('')
    setEndDate('')
    setAppliedFilters({
      startDate: undefined,
      endDate: undefined
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getAmountColor = (amount: number) => {
    return amount < 0 ? 'text-red-600' : 'text-green-600'
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertDescription>
              지출 내역을 불러오는 중 오류가 발생했습니다: {error?.message}
            </AlertDescription>
          </Alert>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="mt-4"
            disabled={isFetching}
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            다시 시도
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 필터 섹션 */}
      {showDateFilter && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FilterIcon className="w-5 h-5" />
              기간 필터
            </CardTitle>
            <CardDescription>
              조회할 기간을 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label htmlFor="startDate">시작일</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="endDate">종료일</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleApplyFilters} disabled={isFetching}>
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  조회
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  disabled={isFetching}
                >
                  초기화
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 요약 정보 */}
      {expensesData?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>요약 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">총 건수</p>
                <p className="text-2xl font-bold">{expensesData.summary.totalCount}건</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">총 금액</p>
                <p className={`text-2xl font-bold ${getAmountColor(expensesData.summary.totalAmount)}`}>
                  {formatCurrency(expensesData.summary.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">카테고리</p>
                <p className="text-2xl font-bold">{expensesData.summary.categories.length}개</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">결제수단</p>
                <p className="text-2xl font-bold">{expensesData.summary.paymentMethods.length}개</p>
              </div>
            </div>

            {expensesData.summary.dateRange && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">기간</p>
                <p className="text-sm">
                  {formatDate(expensesData.summary.dateRange.earliest)} ~ {formatDate(expensesData.summary.dateRange.latest)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 지출 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            지출 내역
            {isFetching && <RefreshCwIcon className="w-4 h-4 animate-spin" />}
          </CardTitle>
          <CardDescription>
            {expensesData?.pagination.total
              ? `총 ${expensesData.pagination.total}건 중 ${expensesData.data.length}건 표시`
              : '지출 내역이 없습니다'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[250px]" />
                    <Skeleton className="h-4 w-[200px]" />
                  </div>
                  <Skeleton className="h-4 w-[100px]" />
                </div>
              ))}
            </div>
          ) : expensesData?.data.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">선택한 기간에 지출 내역이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {expensesData?.data.map((expense) => (
                <ExpenseItem key={expense.id} expense={expense} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function ExpenseItem({ expense }: { expense: Expense }) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getAmountColor = (amount: number) => {
    return amount < 0 ? 'text-red-600' : 'text-green-600'
  }

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium">{expense.content}</p>
          {expense.category_main && (
            <Badge variant="secondary">{expense.category_main}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{formatDate(expense.expense_date)}</span>
          {expense.payment_method && (
            <span>{expense.payment_method}</span>
          )}
          {expense.memo && (
            <span className="truncate max-w-xs">{expense.memo}</span>
          )}
        </div>
      </div>
      <div className="text-right">
        <p className={`font-bold ${getAmountColor(expense.amount)}`}>
          {formatCurrency(expense.amount)}
        </p>
      </div>
    </div>
  )
}