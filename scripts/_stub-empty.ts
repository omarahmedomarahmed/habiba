/**
 * An empty module, used only by `render-check.ts` to stand in for
 * `server-only`.
 *
 * `server-only` is a **bundler guard**: its whole implementation is a file
 * that throws unless the `react-server` export condition is set. The render
 * check needs the opposite condition — the full React build, because a class
 * component (the demo error boundary) does not exist in the react-server one —
 * so the guard is replaced rather than satisfied. Nothing about the modules
 * under test changes; they are still the real ones, still running on the
 * server, in a script.
 */
export {};
