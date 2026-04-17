import React from "react";

export interface AnotherComponentProps {
  /** If the component is enabled. */
  enabled: boolean;
}

export const AnotherComponent = ({
  enabled,
  ...props
}: AnotherComponentProps & React.HTMLProps<HTMLDivElement>) => {
  return <div {...props}>{enabled ? "On" : "Off"}</div>;
};
