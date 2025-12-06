import React from "react";

export interface SimpleComponentProps {
  /** A description for the name prop. */
  name: string;
  age: number;
}

/** A simple component for testing. */
export const SimpleComponent = ({ name, age }: SimpleComponentProps) => {
  return (
    <div>
      {name} - {age}
    </div>
  );
};
