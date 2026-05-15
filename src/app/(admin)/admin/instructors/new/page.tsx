/**
 * A008 講師新規登録
 */
import Link from 'next/link';
import { InstructorForm } from '@/components/admin/instructor-form';
import { createInstructorAction } from '@/lib/admin/instructor-actions';

const ERROR_MESSAGES: Record<string, string> = {
  validation: '入力内容に不備があります。必須項目を確認してください。',
  auth_user_create: '認証ユーザーの作成に失敗しました。メールアドレスをご確認ください。',
  instructor_create: '講師レコードの作成に失敗しました。',
};

export default function NewInstructorPage({ searchParams }: { searchParams: { error?: string } }) {
  const errorMessage = searchParams.error ? ERROR_MESSAGES[searchParams.error] : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">講師を新規登録</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            登録後、招待メールから講師がパスワードを設定します
          </p>
        </div>
        <Link href="/admin/instructors" className="text-sm text-muted-foreground underline">
          ← 一覧へ戻る
        </Link>
      </div>

      {errorMessage && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errorMessage}
        </p>
      )}

      <InstructorForm
        action={createInstructorAction}
        submitLabel="登録して招待メールを準備"
        cancelHref="/admin/instructors"
      />
    </div>
  );
}
