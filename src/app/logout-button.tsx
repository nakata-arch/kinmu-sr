export function LogoutButton() {
  return (
    <form method="post" action="/auth/logout">
      <button
        type="submit"
        className="rounded border border-line px-3 py-1.5 text-xs text-text-mid transition hover:border-text-light hover:text-text-strong"
      >
        ログアウト
      </button>
    </form>
  );
}
