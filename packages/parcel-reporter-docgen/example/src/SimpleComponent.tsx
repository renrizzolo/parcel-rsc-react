import React from "react";

export interface SimpleComponentProps {
  /** A description for the name prop. */
  name: string;
  age: number;
  variant?: "zeta" | "alpha" | "beta";
}

/** A simple component for testing. */
export const SimpleComponent = ({
  name,
  age,
  variant = "alpha",
}: SimpleComponentProps) => {
  return (
    <div data-variant={variant}>
      {name} - {age}
    </div>
  );
};
