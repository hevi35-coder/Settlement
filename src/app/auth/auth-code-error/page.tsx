'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AuthCodeErrorPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center text-red-600">
            인증 오류
          </CardTitle>
          <CardDescription className="text-center">
            로그인 과정에서 문제가 발생했습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertDescription>
              인증 코드가 유효하지 않거나 만료되었습니다.
              다시 로그인을 시도해주세요.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full"
            >
              로그인 페이지로 돌아가기
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/')}
              className="w-full"
            >
              홈으로 이동
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}