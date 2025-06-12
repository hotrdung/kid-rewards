// src/components/parent/ParentRewardHistory.js
import React, { useState } from 'react';
import { formatShortDate, getStartOfDay, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth } from '../../utils/dateHelpers';
import Card from '../common/Card';
import SelectField from '../common/SelectField';

const ParentRewardHistory = ({ familyId, redeemedRewards, completedTasks, kidsInFamily, rewardsInFamily, tasksInFamily }) => {
    const [filterPeriod, setFilterPeriod] = useState('all');
    const now = new Date();

    const filterData = (data, dateField) => {
        if (filterPeriod === 'all') return data;
        return data.filter(item => {
            const itemDate = item[dateField]?.toDate();
            if (!itemDate) return false;
            if (filterPeriod === 'today') return getStartOfDay(itemDate).getTime() === getStartOfDay(now).getTime();
            if (filterPeriod === 'week') return itemDate >= getStartOfWeek(now) && itemDate <= getEndOfWeek(now);
            if (filterPeriod === 'month') return itemDate >= getStartOfMonth(now) && itemDate <= getEndOfMonth(now);
            return true;
        });
    };

    const filteredRedeemed = filterData(redeemedRewards, 'dateRedeemed')
        .sort((a, b) => b.dateRedeemed.toMillis() - a.dateRedeemed.toMillis());
    const filteredCompleted = filterData(completedTasks.filter(ct => ct.status === 'approved' || ct.status === 'rejected'), 'dateApprovedOrRejected')
        .sort((a, b) => b.dateApprovedOrRejected.toMillis() - a.dateApprovedOrRejected.toMillis());

    return (
        <Card>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700">History</h3>
                <SelectField
                    value={filterPeriod}
                    onChange={e => setFilterPeriod(e.target.value)}
                    options={[
                        { value: 'all', label: 'All Time' },
                        { value: 'today', label: 'Today' },
                        { value: 'week', label: 'This Week' },
                        { value: 'month', label: 'This Month' }
                    ]}
                />
            </div>
            <div className="mb-8">
                <h4 className="text-xl font-semibold text-gray-600 mb-3">Redeemed Rewards</h4>
                {filteredRedeemed.length === 0 ? <p className="text-gray-500">No rewards activity for this period.</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kid</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reward</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processed By</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRedeemed.map(rr => {
                                    const k = kidsInFamily.find(k => k.id === rr.kidId);
                                    let statusClass = '', statusBgClass = '';
                                    if (rr.status === 'cancelled_by_parent') { statusClass = 'text-red-700'; statusBgClass = 'bg-red-50'; }
                                    else if (rr.status === 'fulfilled') { statusClass = 'text-green-700'; statusBgClass = 'bg-green-50'; }
                                    else if (rr.status === 'pending_fulfillment') { statusClass = 'text-yellow-700'; statusBgClass = 'bg-yellow-50'; }
                                    return (
                                        <tr key={rr.id} className={statusBgClass}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{formatShortDate(rr.dateRedeemed)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{k?.name || 'N/A'}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{rr.rewardName || 'N/A'}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{rr.pointsSpent}</td>
                                            <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${statusClass || 'text-gray-700'}`}>{rr.status?.replace(/_/g, ' ') || 'Pending'}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{rr.fulfilledBy || rr.cancelledBy || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div>
                <h4 className="text-xl font-semibold text-gray-600 mb-3">Task Submissions</h4>
                {filteredCompleted.length === 0 ? <p className="text-gray-500">No tasks submitted/reviewed for this period.</p> : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date Reviewed</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kid</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processed By</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredCompleted.map(ct => {
                                    const k = kidsInFamily.find(k => k.id === ct.kidId);
                                    let statusClass = '', statusBgClass = '';
                                    if (ct.status === 'approved') { statusClass = 'text-green-600'; statusBgClass = 'bg-green-50'; }
                                    else if (ct.status === 'rejected') { statusClass = 'text-red-600'; statusBgClass = 'bg-red-50'; }
                                    else { statusClass = 'text-yellow-600'; statusBgClass = 'bg-yellow-50'; }
                                    return (
                                        <tr key={ct.id} className={statusBgClass}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{formatShortDate(ct.dateApprovedOrRejected)}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{k?.name || ct.kidName || 'N/A'}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{ct.taskName}</td>
                                            <td className={`px-4 py-2 whitespace-nowrap text-sm font-medium ${statusClass}`}>{ct.status?.replace('_', ' ')}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm">{ct.pointsAwarded || 0}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{ct.processedBy || '-'}</td>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate" title={ct.approvalNote}>{ct.approvalNote || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default ParentRewardHistory;