import { useMembers, Member } from "./useMembers";

export function useStaff(tenantSlug: string) {
    const { data, ...rest } = useMembers(tenantSlug) as any;
    const members = data?.members || [];

    const staff = members.filter((m: Member) =>
        m.roles && (
            m.roles.some((r: any) => ['owner', 'admin', 'instructor'].includes(r.role))
        )
    );

    return {
        staff,
        ...rest
    };
}
