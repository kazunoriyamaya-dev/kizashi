/**
 * ログアウトボタン (Server Action)
 *
 * 各ロール画面のヘッダーで使用。
 */
import { Button } from '@/components/ui/button';
import { signOutAction } from '@/lib/auth/actions';
import type { Role } from '@/lib/permissions';

interface SignOutButtonProps {
  role: Role;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm';
}

export function SignOutButton({ role, variant = 'ghost', size = 'sm' }: SignOutButtonProps) {
  return (
    <form action={signOutAction.bind(null, role)}>
      <Button type="submit" variant={variant} size={size}>
        ログアウト
      </Button>
    </form>
  );
}
