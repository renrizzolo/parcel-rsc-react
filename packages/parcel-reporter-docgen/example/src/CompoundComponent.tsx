import React from "react";

export interface CompoundComponentProps {
  /** Main label description */
  label: string;
}

export function CompoundComponent({ label }: CompoundComponentProps) {
  return <div>{label}</div>;
}

export interface CompoundSubProps {
  /** Sub prop description */
  subProp: number;
}

export function CompoundSub({ subProp }: CompoundSubProps) {
  return <span>{subProp}</span>;
}

CompoundComponent.Sub = CompoundSub;
