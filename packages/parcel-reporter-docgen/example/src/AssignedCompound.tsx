import React from "react";

export interface AssignedCompoundProps {
  /** Height of the component */
  height?: string;
}

export function AssignedCompoundBase({ height }: AssignedCompoundProps) {
  return <div>{height}</div>;
}

export interface AssignedCompoundMainProps {
  /** Main element tag */
  as?: string;
}

export function AssignedCompoundMain({ as }: AssignedCompoundMainProps) {
  return <main>{as}</main>;
}

export const AssignedCompound = Object.assign(AssignedCompoundBase, {
  Main: AssignedCompoundMain,
});
