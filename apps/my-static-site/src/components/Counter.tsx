"use client";

import { useState } from "react";

export function Counter({ initialCount = 0 }: { initialCount?: number }) {
  let [count, setCount] = useState(initialCount);

  return (
    <span>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
    </span>
  );
}
