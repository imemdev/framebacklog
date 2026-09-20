"use client";
import { AlertCircle } from "lucide-react";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="empty">
      <div className="empty-icon">
        <AlertCircle />
      </div>
      <h1>Something interrupted this view</h1>
      <p>
        Your saved work is still in the workspace. Try loading the view again.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
      <a href="/">Return to workspace</a>
    </main>
  );
}
