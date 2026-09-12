/**
 * Rendering the real components outside Next. PLAN.md 19.0a, 21R.10.
 *
 * Extracted from `render-check.ts` in 21R so that more than one script can
 * render a component and look at the markup a browser would receive. That is
 * the only kind of check that could have caught C95 — an icon that broke to
 * its own line — because nothing about the block, the props or the import
 * graph is wrong in that bug. It is only wrong on screen.
 */
import React from "react";

/**
 * Two narrow module substitutions, and why each is needed.
 *
 * `next/link` builds a React context at import time and there is no renderer
 * mounted here; it is replaced by a plain anchor (see `verify-sprint17.ts`).
 *
 * `server-only` is a bundler guard whose entire implementation is a throw
 * unless the `react-server` export condition is set — and this script needs
 * the *full* React build, because the demo error boundary is a class component
 * and the react-server build has no `Component`. Nothing under test changes:
 * these are the real modules, rendered on a server, in a script.
 *
 * Deliberately two exact module ids. A broad mock would let a real failure be
 * answered by a stub.
 */
export async function stubModules() {
  /*
   * The components are compiled with the classic JSX runtime under tsx, which
   * expects `React` to be in scope at the call site. Putting it on the global
   * is the least invasive way to run a real component outside Next's compiler
   * — nothing about the component changes. Forgetting it does not fail where
   * you would expect: the component throws "React is not defined", `resolve()`
   * hands the element back untouched, and the render reports "a component
   * suspended", which is a message about the wrong thing entirely.
   */
  (globalThis as { React?: unknown }).React = React;

  const { createRequire } = await import("node:module");
  const Module = (await import("node:module")).default as unknown as {
    _resolveFilename: (request: string, ...rest: unknown[]) => string;
  };
  const require = createRequire(import.meta.url);
  const link = require.resolve("./_stub-link.tsx");
  const empty = require.resolve("./_stub-empty.ts");
  const original = Module._resolveFilename;
  Module._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === "next/link") return link;
    if (request === "server-only") return empty;
    return original.call(this, request, ...rest);
  };
}

/** Await every async component in the tree, leaving plain elements behind. */
export async function resolve(node: unknown): Promise<unknown> {
  if (node === null || node === undefined || typeof node !== "object")
    return node;

  if (Array.isArray(node)) return Promise.all(node.map(resolve));

  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (!("type" in element)) return node;

  if (typeof element.type === "function") {
    /*
     * Server components are run here; client components are left for React.
     *
     * The distinction cannot be read off the function, so it is discovered by
     * trying: a **server** component is a plain function that returns markup
     * (or a promise of it), while a client component reaches for a hook
     * dispatcher that only exists inside a renderer, and a class component
     * cannot be called at all. Both fail loudly and immediately, and the
     * element is handed back untouched for `renderToStaticMarkup`, which knows
     * how to do it properly.
     *
     * This has to run *through* synchronous server components, not only async
     * ones: `PricingTiers` is returned by a plain `Block`, and the first
     * version of this walk stopped at `Block` and reported three pages as "a
     * component suspended" — a failure that had nothing to do with the pages.
     * A partial walk is worse than none, because it still looks like a render.
     */
    try {
      const produced = (element.type as (p: unknown) => unknown)(
        element.props ?? {},
      );
      const awaited = produced instanceof Promise ? await produced : produced;
      return await resolve(awaited);
    } catch {
      return node;
    }
  }

  if (element.props && "children" in element.props) {
    return {
      ...element,
      props: {
        ...element.props,
        children: await resolve(element.props.children),
      },
    };
  }

  return node;
}

/**
 * A component, rendered to the HTML a browser would receive.
 *
 * `stubModules()` must already have run: the substitutions have to be in place
 * before anything reaches `server-only`, and a static import runs first.
 */
export async function renderMarkup(
  element: React.ReactElement,
): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const tree = await resolve(element);
  return renderToStaticMarkup(tree as React.ReactElement);
}
