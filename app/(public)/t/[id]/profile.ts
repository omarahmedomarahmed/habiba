import { cache } from "react";

import { publicProfile as readProfile } from "@/lib/data/radar";

/**
 * One read of the profile per request, shared by the layout that refuses a
 * missing one (B35), the metadata and the page. The same name as the reader it
 * wraps, because `verify:principals` recognises this capability by that name.
 */
export const publicProfile = cache((id: string) => readProfile(id));
