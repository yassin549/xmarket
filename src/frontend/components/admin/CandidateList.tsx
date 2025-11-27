import CandidateCard from './CandidateCard';

interface Candidate {
    candidate_id: string;
    snapshot_id: string;
    summary: string;
    confidence: number;
    metadata: any;
    status: string;
    created_at: string;
}

interface CandidateListProps {
    candidates: Candidate[];
    onAction: (candidateId: string, action: 'approve' | 'reject') => Promise<void>;
}

export default function CandidateList({ candidates, onAction }: CandidateListProps) {
    if (candidates.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 text-lg">No pending candidates to review.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {candidates.map((candidate) => (
                <CandidateCard
                    key={candidate.candidate_id}
                    candidate={candidate}
                    onAction={onAction}
                />
            ))}
        </div>
    );
}
