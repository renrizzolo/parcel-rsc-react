"use client";

import { useState } from "react";
import {
  Button,
  HStack,
  Label,
  RadioGroup,
  ThemeToggle,
  VStack,
  vars,
} from "@cumulo/core";
import { cx, style } from "@cumulo/css";

const demoCardStyle = style({
  padding: vars.spacing.md,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.border}`,
  backgroundColor: vars.bg["1"],
});

export function CumuloDemo() {
  const [clicks, setClicks] = useState(0);
  const [bundler, setBundler] = useState("parcel");

  return (
    <section className={cx(demoCardStyle)}>
      <VStack gap="md">
        <h2>Cumulo UI Demo</h2>
        <HStack gap="sm" align="center">
          <ThemeToggle showLabel />
          <Button
            type="button"
            variant="secondary"
            onClick={() => setClicks((c) => c + 1)}
          >
            Cumulo Button ({clicks})
          </Button>
        </HStack>
        <RadioGroup.Root
          name="bundler-choice"
          value={bundler}
          onValueChange={setBundler}
          orientation="horizontal"
        >
          <HStack gap="xs" align="center">
            <RadioGroup.Item value="parcel" id="bundler-parcel" />
            <Label htmlFor="bundler-parcel">Parcel</Label>
          </HStack>
          <HStack gap="xs" align="center">
            <RadioGroup.Item value="vite" id="bundler-vite" />
            <Label htmlFor="bundler-vite">Vite</Label>
          </HStack>
        </RadioGroup.Root>
        <p>
          Selected bundler: <strong>{bundler}</strong>
        </p>
      </VStack>
    </section>
  );
}
