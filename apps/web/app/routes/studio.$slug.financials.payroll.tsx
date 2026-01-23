import { useOutletContext } from "react-router";
import { useState, useEffect } from "react";
import { apiRequest } from "../utils/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Loader2, DollarSign, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger
} from "~/components/ui/dialog";
import { ConfirmDialog } from "~/components/ui/ConfirmDialog";

// We'll need rudimentary UI components, if not present we'll use standard HTML/Tailwind

export default function PayrollDashboard() {
    const { tenant } = useOutletContext<any>() as any;
    // @ts-ignore
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        // @ts-ignore
        window.Clerk?.session?.getToken().then(setToken);
    }, []);

    if (!token) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

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
                    <RunPayroll token={token} />
                </TabsContent>

                <TabsContent value="history">
                    <PayrollHistory token={token} />
                </TabsContent>

                <TabsContent value="config">
                    <PayrollConfig token={token} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function RunPayroll({ token }: { token: string }) {
    const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd')); // Start of month
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd')); // Today
    const [preview, setPreview] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handlePreview = async () => {
        setLoading(true);
        try {
            const res = await apiRequest('/payroll/generate', token, {
                method: 'POST',
                body: JSON.stringify({ startDate, endDate, commit: false })
            }) as any;
            setPreview(res.preview);
        } catch (e) {
            console.error(e);
            alert("Failed to generate preview");
        } finally {
            setLoading(false);
        }
    };

    const handleCommit = async () => {
        setShowConfirm(true);
    };

    const confirmCommit = async () => {
        setLoading(true);
        try {
            const res = await apiRequest('/payroll/generate', token, {
                method: 'POST',
                body: JSON.stringify({ startDate, endDate, commit: true })
            }) as any;
            if (res.success) {
                alert(`Successfully generated ${res.count} payouts.`);
                setPreview(null);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to commit payroll");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Generate Cycle</h3>
            <div className="flex gap-4 items-end mb-6">
                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 rounded px-3 py-2 text-sm" />
                </div>
                <button onClick={handlePreview} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                    {loading ? 'Processing...' : 'Preview Calculation'}
                </button>
            </div>

            {preview && (
                <div className="space-y-4">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg flex justify-between items-center">
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">Total Calculation</span>
                        <span className="text-xl font-bold text-green-600">
                            ${(preview.reduce((acc: any, curr: any) => acc + curr.amount, 0) / 100).toFixed(2)}
                        </span>
                    </div>

                    <div className="space-y-2">
                        {preview.map((p: any) => (
                            <div key={p.instructorId} className="border border-zinc-200 dark:border-zinc-800 rounded p-4 flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">Instructor ID: {p.instructorId.substring(0, 8)}...</div>
                                    <div className="text-xs text-zinc-500">{p.itemCount} items calculated</div>
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

                    {preview.length === 0 && <div className="text-zinc-500 text-sm">No payouts calculated for this period. check configurations or activity.</div>}

                    {preview.length > 0 && (
                        <div className="flex justify-end mt-6">
                            <button onClick={handleCommit} disabled={loading} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded shadow font-medium">
                                Generate & Save
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function PayrollHistory({ token }: { token: string }) {
    const [history, setHistory] = useState<any[]>([]);
    const [itemToPay, setItemToPay] = useState<string | null>(null);
    const [processPaymentId, setProcessPaymentId] = useState<string | null>(null);
    const [processing, setProcessing] = useState(false);

    const fetchHistory = async () => {
        const res = await apiRequest('/payroll/history', token) as any;
        setHistory(res.history);
    };

    useEffect(() => { fetchHistory() }, []);

    const markPaid = (id: string) => {
        setItemToPay(id);
    };

    const confirmMarkPaid = async () => {
        if (!itemToPay) return;
        await apiRequest(`/payroll/${itemToPay}/approve`, token, { method: 'POST' });
        fetchHistory();
        setItemToPay(null);
    };

    const handlePayNow = (id: string) => {
        setProcessPaymentId(id);
    };

    const confirmPayNow = async () => {
        if (!processPaymentId) return;
        setProcessing(true);
        try {
            const res: any = await apiRequest(`/payroll/${processPaymentId}/pay`, token, { method: 'POST' });
            if (res.error) {
                alert("Payment Failed: " + res.error);
            } else {
                alert("Payment Successful! Transfer ID: " + res.transferId);
                fetchHistory();
            }
        } catch (e: any) {
            alert("Payment Error: " + e.message);
        } finally {
            setProcessing(false);
            setProcessPaymentId(null);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
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
                    {history.map(row => (
                        <tr key={row.id}>
                            <td className="p-4">
                                {new Date(row.periodStart).toLocaleDateString()} - {new Date(row.periodEnd).toLocaleDateString()}
                            </td>
                            <td className="p-4 font-medium">
                                <div>{row.instructorFirstName} {row.instructorLastName}</div>
                                {row.stripeAccountId && <div className="text-[10px] text-green-600 font-mono">Connected</div>}
                            </td>
                            <td className="p-4 font-mono font-medium">
                                ${(row.amount / 100).toFixed(2)}
                            </td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    }`}>
                                    {row.status.toUpperCase()}
                                </span>
                            </td>
                            <td className="p-4 flex gap-2">
                                {row.status !== 'paid' && (
                                    <>
                                        <button onClick={() => markPaid(row.id)} className="text-zinc-600 hover:text-zinc-900 text-xs font-medium border border-zinc-200 rounded px-2 py-1">
                                            Mark Paid (Manual)
                                        </button>
                                        {row.stripeAccountId && (
                                            <button onClick={() => handlePayNow(row.id)} className="text-white bg-green-600 hover:bg-green-700 text-xs font-medium rounded px-2 py-1 shadow-sm flex items-center gap-1">
                                                <DollarSign size={12} /> Pay Now
                                            </button>
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


            <ConfirmDialog
                open={!!itemToPay}
                onOpenChange={(open) => !open && setItemToPay(null)}
                onConfirm={confirmMarkPaid}
                title="Mark as Paid"
                description="Are you sure you want to manually mark this record as paid?"
                confirmText="Mark Paid"
            />

            <ConfirmDialog
                open={!!processPaymentId}
                onOpenChange={(open) => !open && setProcessPaymentId(null)}
                onConfirm={confirmPayNow}
                title="Process Stripe Transfer"
                description="This will instantly transfer funds from your platform balance to the instructor's connected Stripe account. This cannot be undone."
                confirmText={processing ? "Processing..." : "Pay Now"}
            />
        </div >
    )
}

function PayrollConfig({ token }: { token: string }) {
    const [instructors, setInstructors] = useState<any[]>([]);

    // Config form
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formModel, setFormModel] = useState('flat');
    const [formRate, setFormRate] = useState('0');

    const fetchConfig = async () => {
        const res = await apiRequest('/payroll/config', token) as any;
        setInstructors(res.instructors);
    };

    useEffect(() => { fetchConfig() }, []);

    const handleSave = async () => {
        if (!editingId) return;
        let rate = parseFloat(formRate);
        if (formModel === 'flat' || formModel === 'hourly') {
            // Convert to cents
            rate = Math.round(rate * 100);
        } else {
            // Percentage: basis points. Input 50% -> 5000
            rate = Math.round(rate * 100);
        }

        await apiRequest('/payroll/config', token, {
            method: 'POST',
            body: JSON.stringify({
                memberId: editingId,
                payModel: formModel,
                rate
            })
        });
        setEditingId(null);
        fetchConfig();
    };

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

    return (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800 text-zinc-500 font-medium border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                        <th className="p-4">Name</th>
                        <th className="p-4">Current Model</th>
                        <th className="p-4">Rate</th>
                        <th className="p-4">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {instructors.map(inst => (
                        <tr key={inst.memberId}>
                            <td className="p-4 font-medium">{inst.firstName} {inst.lastName}</td>
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
                            <td className="p-4">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <button onClick={() => startEdit(inst)} className="text-blue-600 hover:text-blue-500 font-medium">Configure</button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Configure Payroll</DialogTitle>
                                            <DialogDescription>Set default pay rate for {inst.firstName}.</DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1">Pay Model</label>
                                                <select className="w-full rounded border border-zinc-300 p-2" value={formModel} onChange={e => setFormModel(e.target.value)}>
                                                    <option value="flat">Flat Rate (Per Class)</option>
                                                    <option value="hourly">Hourly Rate</option>
                                                    <option value="percentage">Revenue Share (%)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1">
                                                    {formModel === 'percentage' ? 'Percentage (%)' : 'Rate ($)'}
                                                </label>
                                                <input type="number" step="0.01" className="w-full rounded border border-zinc-300 p-2" value={formRate} onChange={e => setFormRate(e.target.value)} />
                                            </div>
                                            <button onClick={handleSave} className="w-full bg-blue-600 text-white rounded py-2 font-medium">Save Configuration</button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
