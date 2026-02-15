import { useMembers } from "./useMembers";

export function useStudents(tenantSlug: string, options?: any) {
    // Currently just wraps useMembers, but allows for future student-specific filtering or logic
    return useMembers(tenantSlug, options);
}
