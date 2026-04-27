import { Button } from '@/components/ui/button';

export function LogoutButton() {
  return (
    <form method="post" action="/auth/logout">
      <Button type="submit" variant="outline">
        ログアウト
      </Button>
    </form>
  );
}
