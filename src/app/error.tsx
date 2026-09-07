"use client";

import { useEffect } from "react";
import ErrorState, { RetryButton, CloudIcon } from "@/components/ErrorState";

/* Every page under the root layout renders through WordPress, so when the
   origin returns a 500 the fetch throws and the whole segment dies. Without
   this file Next shows its own "a server error occurred" screen, which tells
   a reader nothing and offers them nothing. `reset()` re-renders the segment,
   which re-runs the fetch — usually all a brief origin hiccup needs. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // the machine-readable half still goes somewhere, just not at the reader
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      icon={<CloudIcon />}
      title="We couldn't load this page"
      hint="Our article service didn't answer just now. Nothing is wrong on your side — give it a second and try again."
      action={<RetryButton onClick={reset} />}
      secondary={{ href: "/", label: "Go to home" }}
      digest={error.digest}
    />
  );
}
