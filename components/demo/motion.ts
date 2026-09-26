/**
 * The design system's motion (`app/design/_ds/motion.tsx`), for the website's
 * example screens: a rise on enter, a spring on select, numbers that count, and
 * `reducedMotion="user"` over all of it, so a device that asks for less motion
 * gets fades.
 *
 * One door for the demos, so the demo files themselves import nothing from
 * `app/`: `verify:sprint77` holds the patient phone to "no action, no route"
 * by reading its imports, and a motion helper is neither.
 */
export { Count, MotionRoot, soft, spring } from "@/app/design/_ds/motion";
