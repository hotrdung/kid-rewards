// src/components/kid/KidHistory.js
import React, { useState } from 'react';
import { formatShortDate, getStartOfDay, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth } from '../../utils/dateHelpers';
import Card from '../common/Card';
import SelectField from '../common/SelectField';

const KidHistory = ({ kid, familyId, completedTasks, redeemedRewards }) => {
    const [filterPeriod, setFilterPeriod] = useState('all');
    const now = new Date();

    const filterData = (data, dateField) => {
        if (filterPeriod === 'all') return data;
        return data.filter(item => {
            const iDate = item[dateField]?.toDate();
            if (!iDate) return false;
            if (filterPeriod === 'today') return getStartOfDay(iDate).getTime() === getStartOfDay(now).getTime();
            if (filterPeriod === 'week') return iDate >= getStartOfWeek(now) && iDate <= getEndOfWeek(now);
            if (filterPeriod === 'month') return iDate >= getStartOfMonth(now) && iDate <= getEndOfMonth(now);
            return true;
        });
    };

    const kidCompletedTasks = completedTasks.filter(ct => ct.kidId === kid.id);
    const kidRedeemedRewards = redeemedRewards.filter(rr => rr.kidId === kid.id);

    const filteredCompletedTasks = filterData(kidCompletedTasks, 'dateSubmitted').sort((a, b) => b.dateSubmitted.toMillis() - a.dateSubmitted.toMillis());
    const filteredRedeemedRewards = filterData(kidRedeemedRewards, 'dateRedeemed').sort((a, b) => b.dateRedeemed.toMillis() - a.dateRedeemed.toMillis());

    const getStatusClass = (status) => {
        switch (status) {
            case 'approved': return 'text-green-600';
            case 'rejected': return 'text-red-600';
            case 'pending_approval': return 'text-yellow-600';
            case 'pending_fulfillment': return 'text-blue-600';
            case 'fulfilled': return 'text-purple-600';
            case 'cancelled_by_parent': return 'text-pink-600 line-through';
            default: return 'text-gray-600';
        }
    };

    const getStatusBgClass = (status) => {
        switch (status) {
            case 'approved': return 'bg-green-50';
            case 'rejected': return 'bg-red-50';
            case 'pending_approval': return 'bg-yellow-50';
            case 'pending_fulfillment': return 'bg-blue-50';
            case 'fulfilled': return 'bg-purple-50';
            case 'cancelled_by_parent': return 'bg-pink-50';
            default: return 'bg-gray-50';
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-end mb-0 -mt-4">
                <SelectField value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} options={[{ value: 'all', label: 'All Time' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'This Week' }, { value: 'month', label: 'This Month' }]} />
            </div>
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Task History</h3>
                {filteredCompletedTasks.length === 0 ? <p className="text-gray-500">No tasks submitted for this period.</p> : (
                    <ul className="space-y-3">
                        {filteredCompletedTasks.map(ct => (
                            <li key={ct.id} className={`p-3 rounded-lg shadow-sm ${getStatusBgClass(ct.status)}`}>
                                <p className="font-medium text-gray-800">{ct.taskName}</p>
                                <p className="text-sm text-gray-500">Submitted: {formatShortDate(ct.dateSubmitted)}{ct.taskDueDate && ` (Due: ${formatShortDate(ct.taskDueDate)})`}</p>
                                <p className="text-sm text-gray-500">Status: <span className={`font-semibold ${getStatusClass(ct.status)}`}>{ct.status?.replace(/_/g, ' ') || 'Pending'}</span>{ct.status === 'approved' && ` (+${ct.pointsAwarded || ct.taskPoints || 0} pts)`}</p>
                                {ct.approvalNote && <p className="text-xs text-gray-600 mt-1 italic">Parent Note: {ct.approvalNote}</p>}
                                {ct.processedBy && <p className="text-xs text-gray-500 mt-1">Processed by: {ct.processedBy}</p>}
                                {ct.dateApprovedOrRejected && <p className="text-xs text-gray-400 mt-0.5">Reviewed: {formatShortDate(ct.dateApprovedOrRejected)}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
            <Card>
                <h3 className="text-2xl font-semibold text-gray-700 mb-6">My Redeemed Rewards</h3>
                {filteredRedeemedRewards.length === 0 ? <p className="text-gray-500">No rewards redeemed for this period.</p> : (
                    <ul className="space-y-3">
                        {filteredRedeemedRewards.map(rr => (
                            <li key={rr.id} className={`p-3 rounded-lg shadow-sm ${getStatusBgClass(rr.status)}`}>
                                <p className="font-medium text-gray-800">{rr.rewardName}</p>
                                <p className="text-sm text-gray-500">Requested: {formatShortDate(rr.dateRedeemed)} for {rr.pointsSpent} points</p>
                                <p className="text-sm text-gray-500">Status: <span className={`font-semibold ${getStatusClass(rr.status)}`}>{rr.status?.replace(/_/g, ' ') || 'Unknown'}</span></p>
                                {rr.dateFulfilled && <p className="text-xs text-gray-500">Fulfilled: {formatShortDate(rr.dateFulfilled)}</p>}
                                {rr.dateCancelled && <p className="text-xs text-gray-500">Cancelled: {formatShortDate(rr.dateCancelled)}</p>}
                                {rr.cancellationNote && <p className="text-xs text-gray-600 mt-1 italic">Parent Note: {rr.cancellationNote}</p>}
                                {(rr.fulfilledBy || rr.cancelledBy) && <p className="text-xs text-gray-500 mt-1">Processed by: {rr.fulfilledBy || rr.cancelledBy}</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
};

export default KidHistory;