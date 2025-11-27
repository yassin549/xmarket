/**
 * Approval Banner Component
 * 
 * Shows human approval status for political/economic markets.
 */

import { Market } from '@/types/market';

interface ApprovalBannerProps {
    market: Market;
}

export default function ApprovalBanner({ market }: ApprovalBannerProps) {
    if (!market.human_approval) {
        return null;
    }

    // Only show for political and economic markets
    const shouldShowBanner = market.type === 'political' || market.type === 'economic';

    if (!shouldShowBanner) {
        return null;
    }

    const approvedDate = market.approved_at
        ? new Date(market.approved_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : 'Unknown date';

    return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="text-sm text-green-800 font-medium">
                        Human-Reviewed Market
                    </p>
                    <p className="text-sm text-green-700 mt-1">
                        This market was reviewed and approved by{' '}
                        <span className="font-medium">{market.approved_by || 'admin'}</span>
                        {' '}on {approvedDate}.
                    </p>
                </div>
            </div>
        </div>
    );
}
