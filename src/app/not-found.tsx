export default function NotFound() {
  return (
    <main className="empty">
      <h1>This page isn’t here</h1>
      <p>
        The link may be out of date. Return to your workspace to find your tasks
        and screens.
      </p>
      <a className="button primary" href="/">
        Open workspace
      </a>
    </main>
  );
}
