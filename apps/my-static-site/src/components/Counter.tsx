"use client";

import { useState } from "react";

export function Counter() {
  let [count, setCount] = useState(0);

  return (
    <span>
      <button onClick={() => setCount(count + 1)}>Count: {count}</button>
    </span>
  );
}
