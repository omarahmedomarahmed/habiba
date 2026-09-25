import { cache } from "react";

import { publicProfile } from "@/lib/data/radar";

/**
 * One read of the profile per request, shared by the layout that refuses a
 * missing one (B35), the metadata and the page.
 */
export const profileFor = cache((id: string) => publicProfile(id));
