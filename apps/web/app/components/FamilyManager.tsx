import { useState, useEffect } from 'react';
// @ts-ignore
import { useFetcher } from 'react-router';

type FamilyMember = {
    userId: string;
    memberId: string | null;
    firstName: string;
    lastName: string;
    dob: string | null;
};

export function FamilyManager({ token }: { token: string | null }) {
    const fetcher = useFetcher();
    const [family, setFamily] = useState<FamilyMember[]>([]);
    const [isAdding, setIsAdding] = useState(false);

    // Initial Load
    useEffect(() => {
        if (!token) return;
        fetch('/users/me/family', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.family) setFamily(data.family);
            });
    }, [token]);

    // Handle Add Response
    useEffect(() => {
        if (fetcher.data?.success && fetcher.data?.child) {
            setFamily(prev => [...prev, fetcher.data.child]);
            setIsAdding(false);
        }
    }, [fetcher.data]);

    return (
        <div className="bg-white rounded-lg border border-zinc-200 p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-900">Family Members</h3>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                    {isAdding ? 'Cancel' : '+ Add Child'}
                </button>
            </div>

            {isAdding && (
                <fetcher.Form method="post" action="/api/family" className="mb-6 p-4 bg-zinc-50 rounded-md border border-zinc-200">
                    <input type="hidden" name="intent" value="add_child" />
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">First Name</label>
                            <input name="firstName" required className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 mb-1">Last Name</label>
                            <input name="lastName" required className="w-full px-3 py-2 border rounded-md" />
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-zinc-700 mb-1">Date of Birth</label>
                        <input name="dob" type="date" className="w-full px-3 py-2 border rounded-md" />
                    </div>
                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={fetcher.state === 'submitting'}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {fetcher.state === 'submitting' ? 'Adding...' : 'Add Family Member'}
                        </button>
                    </div>
                </fetcher.Form>
            )}

            <div className="space-y-3">
                {family.length === 0 && !isAdding && (
                    <p className="text-zinc-500 text-sm italic">No family members linked.</p>
                )}
                {family.map(member => (
                    <div key={member.userId} className="flex items-center justify-between p-3 border border-zinc-100 rounded-md bg-zinc-50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                                {member.firstName[0]}
                            </div>
                            <div>
                                <p className="font-medium text-sm text-zinc-900">{member.firstName} {member.lastName}</p>
                                <p className="text-xs text-zinc-500">
                                    {member.dob ? new Date(member.dob).toLocaleDateString() : 'No DOB'}
                                    {member.memberId ? ' • Studio Member' : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
