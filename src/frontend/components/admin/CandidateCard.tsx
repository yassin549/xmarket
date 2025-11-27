interface Candidate {
    candidate_id: string;
    snapshot_id: string;
    summary: string;
    confidence: number;
    metadata: any;
    status: string;
    created_at: string;
}

interface CandidateCardProps {
    candidate: Candidate;
    onAction: (candidateId: string, action: 'approve' | 'reject') => Promise<void>;
}

export default function CandidateCard({ candidate, onAction }: CandidateCardProps) {
    const handleApprove = () => onAction(candidate.candidate_id, 'approve');
    const handleReject = () => onAction(candidate.candidate_id, 'reject');

    const sources = candidate.metadata?.sources || [];
    const llmVersion = candidate.metadata?.llm_version || 'unknown';

    return (
        <div className="border rounded-lg p-6 shadow-sm bg-white">
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{candidate.summary}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Confidence: <span className="font-medium">{(candidate.confidence * 100).toFixed(1)}%</span>
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleApprove}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                    >
                        Approve
                    </button>
                    <button
                        onClick={handleReject}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                    >
                        Reject
                    </button>
                </div>
            </div>

            <div className="space-y-2 text-sm">
                <div>
                    <span className="text-gray-600">Snapshot ID:</span>
                    <code className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">{candidate.snapshot_id.substring(0, 16)}...</code>
                </div>
                <div>
                    <span className="text-gray-600">LLM Version:</span>
                    <span className="ml-2 text-gray-900">{llmVersion}</span>
                </div>
                <div>
                    <span className="text-gray-600">Created:</span>
                    <span className="ml-2 text-gray-900">{new Date(candidate.created_at).toLocaleString()}</span>
                </div>
                {sources.length > 0 && (
                    <div>
                        <span className="text-gray-600">Sources:</span>
                        <ul className="ml-6 mt-1 list-disc">
                            {sources.map((source: string, idx: number) => (
                                <li key={idx} className="text-gray-700">{source}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
