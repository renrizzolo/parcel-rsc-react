"use client";

import { HStack, Heading, ThemeToggle, VStack, vars } from "@cumulo/core";
import { cx, style } from "@cumulo/css";

const demoCardStyle = style({
  padding: vars.spacing.md,
  borderRadius: vars.radius.md,
  border: `1px solid ${vars.border}`,
  backgroundColor: vars.bg["1"],
  marginBlock: vars.spacing.xl,
});

export function CumuloDemo() {
  return (
    <section className={cx(demoCardStyle)}>
      <VStack gap="md">
        <Heading as="h2">Cumulo UI Demo</Heading>
        <HStack gap="sm" align="center">
          <ThemeToggle showLabel shape="default" variant="outline" />
          {/*           
          <Button type="button" variant="primary">
            Cumulo Button
          </Button> */}
        </HStack>
      </VStack>
    </section>
  );
}
