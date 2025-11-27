'use client';

import { useEffect, useState } from 'react';
import CandidateList from '@/components/admin/CandidateList';

interface Candidate {
    candidate_id: string;
    snapshot_id: string;
    summary: string;
    confidence: number;
    metadata: any;
    status: string;
    created_at: string;
}

export default function AdminDashboard() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCandidates = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/candidates');
            const data = await response.json();

            if (data.success) {
                setCandidates(data.candidates);
            } else {
                setError(data.error || 'Failed to fetch candidates');
            }
        } catch (err) {
            setError('Network error');
            console.error('Error fetching candidates:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (candidateId: string, action: 'approve' | 'reject') => {
        try {
            const actionType = action === 'approve' ? 'APPROVE_CANDIDATE' : 'REJECT_CANDIDATE';

            const response = await fetch('/api/admin/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action_type: actionType,
                    payload: { candidate_id: candidateId },
                    admin_id: 'system', // TODO: Replace with actual admin ID from auth
                }),
            });

            const data = await response.json();

            if (data.success) {
                // Remove the candidate from the list
                setCandidates((prev) => prev.filter((c) => c.candidate_id !== candidateId));
            } else {
                alert(`Action failed: ${data.error}`);
            }
        } catch (err) {
            console.error('Error processing action:', err);
            alert('Network error');
        }
    };

    useEffect(() => {
        fetchCandidates();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-600 mt-2">Review and approve candidate events</p>
                </div>

                {loading && (
                    <div className="text-center py-12">
                        <p className="text-gray-500">Loading candidates...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {!loading && !error && (
                    <CandidateList candidates={candidates} onAction={handleAction} />
                )}
            </div>
        </div>
    );
}
