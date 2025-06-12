// src/components/parent/ApproveTasks.js
import React, { useState } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { getFamilyScopedCollectionPath } from '../../utils/firestorePaths';
import { calculateNextDueDate, formatShortDate, getStartOfDay } from '../../utils/dateHelpers';
import { Edit3, ThumbsUp, ThumbsDown, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import InputField from '../common/InputField'; // Assuming you might want this for points adjustment
import TextAreaField from '../common/TextAreaField';

const ApproveTasks = ({ familyId, pendingTasks, kidsInFamily, allTasksInFamily, showConfirmation, firebaseUser }) => {
    const [approvalNote, setApprovalNote] = useState('');
    const [currentTaskForApproval, setCurrentTaskForApproval] = useState(null);
    const [pointsToAdjust, setPointsToAdjust] = useState(0);
    const [reopenTaskFlag, setReopenTaskFlag] = useState(true);

    const openApprovalModal = (completedTask) => {
        setCurrentTaskForApproval(completedTask);
        setPointsToAdjust(completedTask.taskPoints);
        setApprovalNote('');
        setReopenTaskFlag(true);
    };

    const closeApprovalModal = () => {
        setCurrentTaskForApproval(null); setApprovalNote(''); setPointsToAdjust(0); setReopenTaskFlag(false);
    };

    const handleConfirmApprovalAction = (status) => {
        const actionText = status === 'approved' ? 'approve' : (reopenTaskFlag ? 'reject and reopen' : 'reject');
        const title = status === 'approved' ? 'Confirm Approval' : 'Confirm Rejection';
        showConfirmation(title, `Are you sure you want to ${actionText} this task submission for "${currentTaskForApproval?.taskName}"?`, () => processApprovalAction(status));
    };

    const processApprovalAction = async (status) => {
        if (!currentTaskForApproval) return;
        try {
            const kidRef = doc(db, getFamilyScopedCollectionPath(familyId, 'kids'), currentTaskForApproval.kidId);
            const completedTaskRef = doc(db, getFamilyScopedCollectionPath(familyId, 'completedTasks'), currentTaskForApproval.id);
            const mainTaskRef = doc(db, getFamilyScopedCollectionPath(familyId, 'tasks'), currentTaskForApproval.taskId);

            const kidDoc = await getDoc(kidRef);
            const mainTaskDoc = await getDoc(mainTaskRef);
            if (!kidDoc.exists() || !mainTaskDoc.exists()) { console.error("Kid or Task document not found"); return; }

            const currentKidData = kidDoc.data();
            const mainTaskData = mainTaskDoc.data();
            const batch = writeBatch(db);
            const approverInfo = firebaseUser ? (firebaseUser.displayName || firebaseUser.email || firebaseUser.uid) : 'System';

            if (status === 'rejected' && reopenTaskFlag) {
                batch.delete(completedTaskRef);
            } else {
                batch.update(completedTaskRef, {
                    status: status,
                    approvalNote: approvalNote.trim() || null,
                    dateApprovedOrRejected: Timestamp.now(),
                    pointsAwarded: status === 'approved' ? pointsToAdjust : 0,
                    processedBy: approverInfo,
                });
                if (status === 'approved') {
                    batch.update(kidRef, {
                        points: (currentKidData.points || 0) + pointsToAdjust,
                        totalEarnedPoints: (currentKidData.totalEarnedPoints || 0) + pointsToAdjust
                    });
                    if (mainTaskData.recurrenceType === 'immediately') {
                        const originalStartDateObj = new Date(mainTaskData.startDate + 'T00:00:00');
                        const originalCustomDueDateObj = mainTaskData.customDueDate ? new Date(mainTaskData.customDueDate + 'T00:00:00') : originalStartDateObj;
                        const diffInMilliseconds = originalCustomDueDateObj.getTime() - originalStartDateObj.getTime();
                        const newClonedStartDate = getStartOfDay(new Date());
                        const newClonedCustomDueDate = new Date(newClonedStartDate.getTime() + diffInMilliseconds);
                        const clonedTaskData = { ...mainTaskData, name: mainTaskData.name, startDate: newClonedStartDate.toISOString().split('T')[0], customDueDate: newClonedCustomDueDate.toISOString().split('T')[0], createdAt: Timestamp.now() };
                        delete clonedTaskData.id; delete clonedTaskData.nextDueDate;
                        clonedTaskData.nextDueDate = calculateNextDueDate(clonedTaskData, getStartOfDay(newClonedCustomDueDate));
                        batch.set(doc(collection(db, getFamilyScopedCollectionPath(familyId, 'tasks'))), clonedTaskData);
                    }
                }
            }

            if (status === 'approved' && mainTaskData.recurrenceType && mainTaskData.recurrenceType !== 'none' && mainTaskData.recurrenceType !== 'immediately') {
                const completedTaskDueDate = currentTaskForApproval.taskDueDate.toDate();
                const dayAfterCompletedTaskDueDate = new Date(completedTaskDueDate);
                dayAfterCompletedTaskDueDate.setDate(dayAfterCompletedTaskDueDate.getDate() + 1);
                const newNextDueDate = calculateNextDueDate({ ...mainTaskData, startDate: new Date(mainTaskData.startDate), customDueDate: mainTaskData.customDueDate ? new Date(mainTaskData.customDueDate) : null, nextDueDate: currentTaskForApproval.taskDueDate }, dayAfterCompletedTaskDueDate);
                batch.update(mainTaskRef, { nextDueDate: newNextDueDate });
            }
            await batch.commit();
            closeApprovalModal();
        } catch (error) {
            console.error(`Error ${status === 'approved' ? 'approving' : 'rejecting'} task: `, error);
        }
    };

    if (pendingTasks.length === 0) {
        return <Card><h3 className="text-2xl font-semibold text-gray-700 mb-6">Approve Tasks</h3><p className="text-gray-500">No tasks pending approval.</p></Card>;
    }

    return (
        <Card>
            <h3 className="text-2xl font-semibold text-gray-700 mb-6">Approve Tasks</h3>
            <ul className="space-y-4">
                {pendingTasks.map(ct => {
                    const kid = kidsInFamily.find(k => k.id === ct.kidId);
                    if (!kid) return <li key={ct.id} className="text-red-500 p-3 bg-red-50 rounded-md">Kid data missing for a pending task.</li>;
                    return (
                        <li key={ct.id} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                            <div className="mb-2 sm:mb-0">
                                <p className="font-semibold text-lg text-gray-800">{kid.name} completed: <span className="text-blue-600">{ct.taskName}</span></p>
                                <p className="text-sm text-gray-500">Submitted: {formatShortDate(ct.dateSubmitted)}</p>
                                <p className="text-sm text-gray-500">Originally Due: {formatShortDate(ct.taskDueDate)}</p>
                                <p className="text-sm text-purple-600 font-semibold">Original Points: {ct.taskPoints}</p>
                            </div>
                            <Button onClick={() => openApprovalModal(ct)} className="bg-indigo-500 hover:bg-indigo-600" icon={Edit3}>Review</Button>
                        </li>
                    );
                })}
            </ul>
            <Modal isOpen={!!currentTaskForApproval} onClose={closeApprovalModal} title={`Review Task: ${currentTaskForApproval?.taskName}`}>
                {currentTaskForApproval && (
                    <div>
                        <p><strong>Kid:</strong> {kidsInFamily.find(k => k.id === currentTaskForApproval.kidId)?.name}</p>
                        <p><strong>Submitted:</strong> {formatShortDate(currentTaskForApproval.dateSubmitted)}</p>
                        <p><strong>Original Due:</strong> {formatShortDate(currentTaskForApproval.taskDueDate)}</p>
                        <div className="my-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Adjust Points (Original: {currentTaskForApproval.taskPoints})</label>
                            <div className="flex items-center space-x-2">
                                <Button onClick={() => setPointsToAdjust(p => Math.max(0, p - 1))} icon={ArrowDownCircle} className="bg-red-500 hover:bg-red-600 px-2 py-1" />
                                <input type="number" value={pointsToAdjust} onChange={e => setPointsToAdjust(Math.max(0, parseInt(e.target.value) || 0))} className="w-20 text-center px-2 py-1 border border-gray-300 rounded-md" />
                                <Button onClick={() => setPointsToAdjust(p => p + 1)} icon={ArrowUpCircle} className="bg-green-500 hover:bg-green-600 px-2 py-1" />
                            </div>
                        </div>
                        <TextAreaField label="Approval/Rejection Note (Optional)" value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="e.g., Great job!" />
                        <div className="mt-4 mb-2">
                            <label className="flex items-center text-sm text-gray-600">
                                <input type="checkbox" checked={reopenTaskFlag} onChange={(e) => setReopenTaskFlag(e.target.checked)} className="mr-2 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                                If rejecting, reopen task for kid to resubmit?
                            </label>
                        </div>
                        <div className="flex justify-end space-x-3 mt-6">
                            <Button onClick={() => handleConfirmApprovalAction('rejected')} className="bg-red-500 hover:bg-red-600" icon={ThumbsDown}>{reopenTaskFlag ? "Reject & Reopen" : "Reject Only"}</Button>
                            <Button onClick={() => handleConfirmApprovalAction('approved')} className="bg-green-500 hover:bg-green-600" icon={ThumbsUp}>Approve</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Card>
    );
};

export default ApproveTasks;