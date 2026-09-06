// First workbench story — proves the two things a story needs to actually
// mean something here: the design-token layer (.ladle/components.tsx's
// src/index.css import) resolving through Tailwind v4's Vite plugin, and
// class-variance-authority's variant/size matrix rendering as this
// component's own author intended, not just "a button-shaped element
// exists". If tokens aren't wired, every variant below still renders
// AS ELEMENTS but collapses to browser-default button styling — a failure
// mode that looks like success in a story list.
import type { StoryDefault } from "@ladle/react";
import { Button, type ButtonProps } from "./button";

export default {
  title: "UI/Button",
} satisfies StoryDefault;

const VARIANTS: NonNullable<ButtonProps["variant"]>[] = [
  "default",
  "destructive",
  "outline",
  "ghost",
  "link",
];
const SIZES: NonNullable<ButtonProps["size"]>[] = ["sm", "default", "lg", "icon"];

export const Variants = () => (
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
    {VARIANTS.map((variant) => (
      <Button key={variant} variant={variant}>
        {variant}
      </Button>
    ))}
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
    {SIZES.map((size) => (
      <Button key={size} size={size}>
        {size === "icon" ? "★" : size}
      </Button>
    ))}
  </div>
);

export const Disabled = () => (
  <div style={{ display: "flex", gap: 12 }}>
    <Button disabled>default</Button>
    <Button variant="destructive" disabled>
      destructive
    </Button>
    <Button variant="outline" disabled>
      outline
    </Button>
  </div>
);

// Interactive — bind Ladle's Controls addon to a real prop, not just a
// fixed example, so the workbench earns its keep over a static screenshot.
export const Playground = (props: ButtonProps) => <Button {...props} />;
Playground.args = { children: "Click me", variant: "default", size: "default" };
Playground.argTypes = {
  variant: { options: VARIANTS, control: { type: "select" } },
  size: { options: SIZES, control: { type: "select" } },
  disabled: { control: { type: "boolean" } },
};
