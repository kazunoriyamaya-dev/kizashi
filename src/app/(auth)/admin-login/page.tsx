import { redirect } from 'next/navigation';

// 旧パスは /admin/login へ redirect
export default function AdminLoginRedirect() {
  redirect('/admin/login');
}
