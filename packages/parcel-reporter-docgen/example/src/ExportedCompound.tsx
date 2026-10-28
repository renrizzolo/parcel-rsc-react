import React from 'react';

export interface ExportedCompoundRootProps {
  /** If the compound is open */
  open?: boolean;
}

export function ExportedCompoundRoot({ open }: ExportedCompoundRootProps) {
  return <div>{open ? 'open' : 'closed'}</div>;
}

export interface ExportedCompoundTriggerProps {
  /** Trigger click handler */
  onClick?: () => void;
}

export function ExportedCompoundTrigger({ onClick }: ExportedCompoundTriggerProps) {
  return <button onClick={onClick}>Toggle</button>;
}

export {
  ExportedCompoundRoot as Root,
  ExportedCompoundTrigger as Trigger,
};
