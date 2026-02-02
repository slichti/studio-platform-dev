import { useMembers } from "./useMembers";

export function useStaff(tenantSlug: string) {
    const { data: members, ...rest } = useMembers(tenantSlug);

    const staff = members?.filter(m =>
        m.roles && (
            m.roles.some((r: any) => ['owner', 'admin', 'instructor'].includes(r.role))
        )
    ) || [];

    return {
        staff,
        ...rest
    };
}
