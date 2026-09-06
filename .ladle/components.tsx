// Runs once, wrapping every story — Ladle's equivalent of src/main.tsx's own
// provider tree (see that file). Two responsibilities:
//
// 1. Import the app's real stylesheet, not a copy. `src/index.css` is where
//    the whole design-token layer lives (:root's HSL triplets, the .light
//    override — see workflow-engine-ui/DESIGN.md) plus Tailwind's own
//    "@import tailwindcss" — without this line every story renders
//    unstyled, which looks like a subtler failure than a crash: the story
//    still "works", it's just plain HTML with no visual signal anything is
//    actually wired.
// 2. Wrap in the same QueryClientProvider + I18nProvider main.tsx provides,
//    since most feature-level components (as opposed to the framework-
//    agnostic src/components/ui primitives the first two stories cover)
//    reach for useQuery and/or t() the moment you go one layer up — see
//    CLAUDE.md's i18n rule. Cheap to include now so the next story written
//    against a feature component doesn't have to add this file first.
import type { GlobalProvider } from "@ladle/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/features/i18n/I18nProvider";
import "../src/index.css";

// retry: false (unlike main.tsx's retry: 1) — a story's query almost always
// has no real backend behind it in this environment, so retrying a failing
// fetch just delays the story settling into its (expected) error/empty
// state instead of speeding anything up.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

export const Provider: GlobalProvider = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>{children}</I18nProvider>
  </QueryClientProvider>
);
