import { useOutletContext, useParams } from "react-router";
import { useState } from "react";
import { apiRequest } from "../utils/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Loader2, DollarSign, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react-router";

import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "~/components/ui/dialog";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Select } from "~/components/ui/select";
import { Card, CardContent } from "~/components/ui/Card";
import { Badge } from "~/components/ui/Badge";
import { usePayrollHistory, usePayrollConfig } from "~/hooks/usePayroll";
import { ComponentErrorBoundary } from "~/components/ErrorBoundary";

export default function PayrollDashboard() {
    const { slug } = useParams();
    const { tenant } = useOutletContext<any>() as any;
    const { getToken } = useAuth();

    if (!slug) return <div>Invalid Slug</div>;

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Instructor Payroll</h1>
                <p className="text-zinc-500 text-sm">Automate calculation and tracking of payouts.</p>
            </div>

            <Tabs defaultValue="run" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="run">Run Payroll</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="config">Configuration</TabsTrigger>
                </TabsList>

                <TabsContent value="run">
                    <RunPayroll slug={slug} />
                </TabsContent>

                <TabsContent value="history">
                    <PayrollHistory slug={slug} />
                </TabsContent>

                <TabsContent value="config">
                    <PayrollConfig slug={slug} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function RunPayroll({ slug }: { slug: string }) {
    const { getToken } = useAuth();
    // Use first day of current month
    const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd')); // Today
    const [preview, setPreview] = useState<any[] | null>(null);
    const [showConfirm, setShowConfirm] = useState(false);

    const generateMutation = useMutation({
        mutationFn: async ({ commit }: { commit: boolean }) => {
            const token = await getToken();
            const res = await apiRequest('/payroll/generate', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({ startDate, endDate, commit })
            }) as any;
            if (res.error) throw new Error(res.error);
            return res;
        },
        onSuccess: (data, variables) => {
            if (variables.commit) {
                toast.success(`Successfully generated ${data.count} payouts.`);
                setPreview(null);
                setShowConfirm(false);
            } else {
                setPreview(data.preview || []);
            }
        },
        onError: (e: any) => toast.error(e.message)
    });

    return (
        <Card>
            <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Generate Cycle</h3>
                <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">Start Date</label>
                        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[180px]" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1">End Date</label>
                        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[180px]" />
                    </div>
                    <Button
                        onClick={() => generateMutation.mutate({ commit: false })}
                        disabled={generateMutation.isPending}
                    >
                        {generateMutation.isPending && !showConfirm ? 'Processing...' : 'Preview Calculation'}
                    </Button>
                </div>

                {preview && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg flex justify-between items-center border border-zinc-100 dark:border-zinc-700">
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">Total Calculation</span>
                            <span className="text-xl font-bold text-green-600">
                                ${(preview.reduce((acc: any, curr: any) => acc + curr.amount, 0) / 100).toFixed(2)}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {preview.map((p: any) => (
                                <div key={p.instructorId} className="border border-zinc-200 dark:border-zinc-800 rounded p-4 flex justify-between items-start bg-white dark:bg-zinc-900">
                                    <div>
                                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                            Instructor
                                            <span className="text-xs font-normal text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded dark:bg-zinc-800">
                                                {p.instructorId.substring(0, 8)}...
                                            </span>
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-1">{p.itemCount} items calculated</div>
                                        <ul className="mt-2 text-xs text-zinc-500 space-y-1">
                                            {p.items.map((item: any, i: number) => (
                                                <li key={i}>• {item.title} ({new Date(item.date).toLocaleDateString()}): {item.details} = <strong>${(item.amount / 100).toFixed(2)}</strong></li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="text-lg font-bold">${(p.amount / 100).toFixed(2)}</div>
                                </div>
                            ))}
                        </div>

                        {preview.length === 0 && <div className="text-zinc-500 text-sm italic">No payouts calculated for this period. Check configurations or activity logs.</div>}

                        {preview.length > 0 && (
                            <div className="flex justify-end mt-6">
                                <Button
                                    onClick={() => setShowConfirm(true)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    Generate & Save
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <ConfirmDialog
                open={showConfirm}
                onOpenChange={setShowConfirm}
                onConfirm={() => generateMutation.mutate({ commit: true })}
                title="Confirm Payroll Generation"
                description="This will create payout records for the calculated amounts. These will appear in history as 'Processing' or 'Pending'."
                confirmText={generateMutation.isPending ? "Generating..." : "Generate Records"}
            />
        </Card>
    );
}

function PayrollHistory({ slug }: { slug: string }) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const { data: history = [], isLoading } = usePayrollHistory(slug);

    const [itemToPay, setItemToPay] = useState<string | null>(null);
    const [processPaymentId, setProcessPaymentId] = useState<string | null>(null);

    const approveMutation = useMutation({
        mutationFn: async (id: string) => {
            const token = await getToken();
            const res = await apiRequest(`/payroll/${id}/approve`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug }
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll-history', slug] });
            setItemToPay(null);
            toast.success("Marked as paid");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const payNowMutation = useMutation({
        mutationFn: async (id: string) => {
            const token = await getToken();
            const res: any = await apiRequest(`/payroll/${id}/pay`, token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug }
            });
            if (res.error) throw new Error(res.error);
            return res;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['payroll-history', slug] });
            setProcessPaymentId(null);
            toast.success("Payment Successful! Transfer ID: " + data.transferId);
        },
        onError: (e: any) => toast.error(e.message)
    });

    if (isLoading) return <div>Loading history...</div>;

    return (
        <>
            <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4">Period</th>
                            <th className="p-4">Instructor</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {history.map((row: any) => (
                            <tr key={row.id}>
                                <td className="p-4">
                                    {new Date(row.periodStart).toLocaleDateString()} - {new Date(row.periodEnd).toLocaleDateString()}
                                </td>
                                <td className="p-4 font-medium">
                                    <div>{row.instructorFirstName} {row.instructorLastName}</div>
                                    {row.stripeAccountId && <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 mt-1">Stripe Connected</Badge>}
                                </td>
                                <td className="p-4 font-mono font-medium">
                                    ${(row.amount / 100).toFixed(2)}
                                </td>
                                <td className="p-4">
                                    <Badge variant={row.status === 'paid' ? 'success' : 'warning'}>
                                        {row.status.toUpperCase()}
                                    </Badge>
                                </td>
                                <td className="p-4 flex gap-2">
                                    {row.status !== 'paid' && (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => setItemToPay(row.id)}>
                                                Mark Paid
                                            </Button>
                                            {row.stripeAccountId && (
                                                <Button size="sm" onClick={() => setProcessPaymentId(row.id)} className="bg-green-600 hover:bg-green-700 text-white">
                                                    <DollarSign size={14} className="mr-1" /> Pay Now
                                                </Button>
                                            )}
                                        </>
                                    )}
                                    {row.status === 'paid' && row.paidAt && (
                                        <span className="text-xs text-zinc-400">Paid {new Date(row.paidAt).toLocaleDateString()}</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {history.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-zinc-500">No history found.</td></tr>}
                    </tbody>
                </table>
            </Card>

            <ConfirmDialog
                open={!!itemToPay}
                onOpenChange={(open) => !open && setItemToPay(null)}
                onConfirm={() => { if (itemToPay) approveMutation.mutate(itemToPay) }}
                title="Mark as Paid"
                description="Are you sure you want to manually mark this record as paid?"
                confirmText="Mark Paid"
            />

            <ConfirmDialog
                open={!!processPaymentId}
                onOpenChange={(open) => !open && setProcessPaymentId(null)}
                onConfirm={() => { if (processPaymentId) payNowMutation.mutate(processPaymentId) }}
                title="Process Stripe Transfer"
                description="This will instantly transfer funds from your platform balance to the instructor's connected Stripe account. This cannot be undone."
                confirmText={payNowMutation.isPending ? "Processing..." : "Pay Now"}
            />
        </>
    )
}

function PayrollConfig({ slug }: { slug: string }) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const { data: instructors = [], isLoading } = usePayrollConfig(slug);

    // Config form
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formModel, setFormModel] = useState('flat');
    const [formRate, setFormRate] = useState('0');

    // Manual Pay State
    const [payModalOpen, setPayModalOpen] = useState(false);
    const [payInstructor, setPayInstructor] = useState<any>(null);
    const [payAmount, setPayAmount] = useState('');
    const [payNote, setPayNote] = useState('');

    const saveConfigMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            let rate = parseFloat(formRate);
            if (formModel === 'flat' || formModel === 'hourly') {
                rate = Math.round(rate * 100);
            } else {
                rate = Math.round(rate * 100);
            }

            const res = await apiRequest('/payroll/config', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    memberId: editingId,
                    payModel: formModel,
                    rate
                })
            });
            if ((res as any).error) throw new Error((res as any).error);
            return res;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['payroll-config', slug] });
            setEditingId(null);
            toast.success("Configuration saved");
        },
        onError: (e: any) => toast.error(e.message)
    });

    const manualPayMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const amountCents = Math.round(parseFloat(payAmount) * 100);
            const res: any = await apiRequest('/payroll/transfer', token, {
                method: 'POST',
                headers: { 'X-Tenant-Slug': slug },
                body: JSON.stringify({
                    instructorId: payInstructor.memberId,
                    amount: amountCents,
                    notes: payNote || 'Manual Ad-Hoc Payout'
                })
            });

            if (res.error) throw new Error(res.error);
            return res;
        },
        onSuccess: () => {
            toast.success('Transfer Successful');
            setPayModalOpen(false);
            setPayInstructor(null);
        },
        onError: (e: any) => toast.error(e.message)
    });


    const startEdit = (inst: any) => {
        setEditingId(inst.memberId);
        if (inst.config?.payModel) {
            setFormModel(inst.config.payModel);
            setFormRate((inst.config.rate / 100).toString());
        } else {
            setFormModel('flat');
            setFormRate('0');
        }
    };

    const openPayModal = (inst: any) => {
        setPayInstructor(inst);
        setPayAmount('');
        setPayNote('');
        setPayModalOpen(true);
    };

    if (isLoading) return <div>Loading config...</div>;

    return (
        <>
            <Card className="overflow-hidden border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Stripe Status</th>
                            <th className="p-4">Current Model</th>
                            <th className="p-4">Rate</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {instructors.map((inst: any) => (
                            <tr key={inst.memberId}>
                                <td className="p-4 font-medium">{inst.firstName} {inst.lastName}</td>
                                <td className="p-4">
                                    {inst.stripeAccountId ? (
                                        <Badge variant="success" className="text-xs"><CheckCircle2 size={12} className="mr-1" /> Connected</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="text-xs">Not Connected</Badge>
                                    )}
                                </td>
                                <td className="p-4 text-zinc-600 dark:text-zinc-400 capitalize">
                                    {inst.config ? inst.config.payModel : 'Not Set'}
                                </td>
                                <td className="p-4 font-mono">
                                    {inst.config ? (
                                        inst.config.payModel === 'percentage'
                                            ? `${(inst.config.rate / 100)}%`
                                            : `$${(inst.config.rate / 100).toFixed(2)}`
                                    ) : '-'}
                                </td>
                                <td className="p-4 flex gap-2">
                                    <Dialog open={editingId === inst.memberId} onOpenChange={(open) => !open && setEditingId(null)}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" onClick={() => startEdit(inst)}>Configure</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Configure Payroll</DialogTitle>
                                                <DialogDescription>Set default pay rate for {inst.firstName}.</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">Pay Model</label>
                                                    <Select value={formModel} onChange={(e) => setFormModel(e.target.value)} className="w-full border-zinc-300">
                                                        <option value="flat">Flat Rate (Per Class)</option>
                                                        <option value="hourly">Hourly Rate</option>
                                                        <option value="percentage">Revenue Share (%)</option>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium mb-1">
                                                        {formModel === 'percentage' ? 'Percentage (%)' : 'Rate ($)'}
                                                    </label>
                                                    <Input type="number" step="0.01" value={formRate} onChange={e => setFormRate(e.target.value)} />
                                                </div>
                                                <Button onClick={() => saveConfigMutation.mutate()} className="w-full" disabled={saveConfigMutation.isPending}>
                                                    Save Configuration
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    {inst.stripeAccountId && (
                                        <Button size="sm" onClick={() => openPayModal(inst)} className="bg-green-600 hover:bg-green-700 text-white">
                                            <DollarSign size={14} className="mr-1" /> Pay
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            {/* Manual Pay Modal */}
            <Dialog open={payModalOpen} onOpenChange={setPayModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Manual Payout</DialogTitle>
                        <DialogDescription>
                            Send an ad-hoc payment to {payInstructor?.firstName}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Amount ($)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-zinc-500">$</span>
                                <Input
                                    type="number"
                                    min="0.50"
                                    step="0.01"
                                    value={payAmount}
                                    onChange={e => setPayAmount(e.target.value)}
                                    className="pl-8"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Note / Reference</label>
                            <Input
                                type="text"
                                value={payNote}
                                onChange={e => setPayNote(e.target.value)}
                                placeholder="e.g. Bonus for weekend workshop"
                            />
                        </div>

                        <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded flex gap-2">
                            <AlertCircle size={16} className="shrink-0" />
                            <p>Funds will be transferred immediately from your platform balance to the instructor's Stripe account. This cannot be undone.</p>
                        </div>

                        <Button
                            onClick={() => manualPayMutation.mutate()}
                            disabled={manualPayMutation.isPending || !payAmount}
                            className={`w-full ${manualPayMutation.isPending ? 'bg-zinc-400' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {manualPayMutation.isPending ? 'Processing...' : 'Transfer Funds'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
