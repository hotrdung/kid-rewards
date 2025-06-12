// src/components/kid/KidTasksList.js
import React, { useState, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, addDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getFamilyScopedCollectionPath } from '../../utils/firestorePaths';
import { getStartOfDay, getEndOfDay, getStartOfWeek, getEndOfWeek, formatTaskDueDate } from '../../utils/dateHelpers';
import { CheckCircle, RefreshCcw, AlertTriangle, Bell } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import SelectField from '../common/SelectField';
import StarIconDisplay from '../common/StarIconDisplay';

const KidTasksList = ({ kid, familyId, allTasks, completedTasks, showConfirmation }) => {
    const [showFeedback, setShowFeedback] = useState('');
    const [feedbackType, setFeedbackType] = useState('info'); // 'info', 'success', 'error'
    const [taskViewPeriod, setTaskViewPeriod] = useState('today'); // 'today', 'week', or 'all_upcoming'

    const today = useMemo(() => getStartOfDay(new Date()), []);
    const todayEnd = useMemo(() => getEndOfDay(today), [today]);
    const weekStart = useMemo(() => getStartOfWeek(today), [today]);
    const weekEnd = useMemo(() => getEndOfWeek(today), [today]);

    const tasksToShow = useMemo(() => {
        return allTasks.filter(task => {
            if (!task.isActive) return false;
            if (task.assignedKidId && task.assignedKidId !== kid.id && task.assignedKidId !== null && task.assignedKidId !== '') {
                return false;
            }

            if (task.recurrenceType === 'none' || task.recurrenceType === 'immediately') {
                const customDueDateAsStartOfDay = task.customDueDate ? getStartOfDay(new Date(task.customDueDate)) : null;
                if (!customDueDateAsStartOfDay) return false;

                const completedOrPendingForThisDueDate = completedTasks.find(ct =>
                    ct.taskId === task.id && ct.kidId === kid.id &&
                    (ct.status === 'approved' || ct.status === 'pending_approval') &&
                    ct.taskDueDate?.toDate().getTime() === customDueDateAsStartOfDay.getTime()
                );
                if (completedOrPendingForThisDueDate) return false;

                if (taskViewPeriod === 'all_upcoming') return true;
                else {
                    const customDueDateEndForPeriodCheck = getEndOfDay(new Date(task.customDueDate));
                    const isOverdue = customDueDateEndForPeriodCheck < today;
                    const isDueToday = customDueDateAsStartOfDay.getTime() === today.getTime();
                    const isInPeriod = customDueDateAsStartOfDay >= today && customDueDateAsStartOfDay <= (taskViewPeriod === 'today' ? todayEnd : weekEnd);
                    return isOverdue || isDueToday || isInPeriod;
                }
            } else { // Recurring tasks
                const nextDueDate = task.nextDueDate?.toDate ? getStartOfDay(task.nextDueDate.toDate()) : null;
                if (!nextDueDate) {
                    if (taskViewPeriod === 'all_upcoming') {
                        const taskActualStartDate = task.startDate ? getStartOfDay(new Date(task.startDate)) : null;
                        if (taskActualStartDate && taskActualStartDate > todayEnd) return true;
                    }
                    return false;
                }
                const submittedOrApprovedForThisDueDate = completedTasks.find(ct =>
                    ct.taskId === task.id && ct.kidId === kid.id &&
                    ct.taskDueDate?.toDate().getTime() === nextDueDate.getTime() &&
                    (ct.status === 'approved' || ct.status === 'pending_approval')
                );
                if (submittedOrApprovedForThisDueDate) return false;

                if (taskViewPeriod === 'all_upcoming') return true;
                else {
                    const isOverdue = nextDueDate < today;
                    const isDueToday = nextDueDate.getTime() === today.getTime();
                    const startsTodayAndIsTodayView = (taskViewPeriod === 'today' && task.startDate && getStartOfDay(new Date(task.startDate)).getTime() === today.getTime());
                    const isInPeriod = (taskViewPeriod === 'today' && (isDueToday || startsTodayAndIsTodayView)) ||
                        (taskViewPeriod === 'week' && nextDueDate >= weekStart && nextDueDate <= weekEnd);
                    return isOverdue || isDueToday || isInPeriod;
                }
            }
        }).sort((a, b) => {
            const getEffectiveDate = (t) => (t.recurrenceType === 'none' || t.recurrenceType === 'immediately' ? (t.customDueDate ? getStartOfDay(new Date(t.customDueDate)).getTime() : Infinity) : (t.nextDueDate?.toMillis() || (t.startDate ? getStartOfDay(new Date(t.startDate)).getTime() : Infinity)));
            return getEffectiveDate(a) - getEffectiveDate(b);
        });
    }, [allTasks, kid.id, completedTasks, taskViewPeriod, today, todayEnd, weekStart, weekEnd]);

    const handleCompleteTask = async (task) => {
        const taskDueDateForCompletion = (task.recurrenceType === 'none' || task.recurrenceType === 'immediately') ? (task.customDueDate ? Timestamp.fromDate(getStartOfDay(new Date(task.customDueDate))) : Timestamp.fromDate(today)) : task.nextDueDate;
        if (!taskDueDateForCompletion) { setShowFeedback(`Cannot determine due date for "${task.name}". Contact parent.`); setFeedbackType('error'); setTimeout(() => setShowFeedback(''), 4000); return; }
        const alreadySubmittedForThisDueDate = completedTasks.find(ct => ct.taskId === task.id && ct.kidId === kid.id && ct.status === 'pending_approval' && ct.taskDueDate?.toDate().getTime() === taskDueDateForCompletion.toDate().getTime());
        if (alreadySubmittedForThisDueDate) { setShowFeedback(`You've already submitted "${task.name}" for this due date. Waiting for approval.`); setFeedbackType('info'); setTimeout(() => setShowFeedback(''), 4000); return; }
        try {
            await addDoc(collection(db, getFamilyScopedCollectionPath(familyId, 'completedTasks')), { kidId: kid.id, kidName: kid.name, taskId: task.id, taskName: task.name, taskPoints: task.points, taskDueDate: taskDueDateForCompletion, dateSubmitted: Timestamp.now(), status: 'pending_approval' });
            setShowFeedback(`Task "${task.name}" submitted for approval!`); setFeedbackType('success');
        } catch (error) { console.error("Error completing task: ", error); setShowFeedback('Error submitting task. Please try again.'); setFeedbackType('error'); }
        finally { setTimeout(() => setShowFeedback(''), 3000); }
    };

    const confirmWithdrawTask = (completedTaskInstance) => {
        showConfirmation("Withdraw Task", `Are you sure you want to withdraw your submission for "${completedTaskInstance.taskName}"?`, () => handleWithdrawTask(completedTaskInstance.id));
    };

    const handleWithdrawTask = async (completedTaskId) => {
        if (!completedTaskId) return;
        try { await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'completedTasks'), completedTaskId)); setShowFeedback("Task submission withdrawn."); setFeedbackType('info'); }
        catch (error) { console.error("Error withdrawing task: ", error); setShowFeedback("Failed to withdraw task. Please try again."); setFeedbackType('error'); }
        finally { setTimeout(() => setShowFeedback(''), 3000); }
    };

    const feedbackColor = { info: 'bg-blue-100 text-blue-700', success: 'bg-green-100 text-green-700', error: 'bg-red-100 text-red-700' };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6">
                <h3 className="text-2xl font-semibold text-gray-700 mb-2 sm:mb-0">My Tasks</h3>
                <SelectField value={taskViewPeriod} onChange={e => setTaskViewPeriod(e.target.value)} options={[{ value: 'today', label: "Today's Tasks" }, { value: 'week', label: "This Week's Tasks" }, { value: 'all_upcoming', label: "All Upcoming Tasks" }]} />
            </div>
            {showFeedback && <p className={`mb-4 p-3 rounded-md ${feedbackColor[feedbackType]}`}>{showFeedback}</p>}
            {tasksToShow.length === 0 ? <p className="text-gray-500">No tasks due for this period, or all due tasks are submitted/completed.</p> : (
                <ul className="space-y-4">
                    {tasksToShow.map(task => {
                        const taskSpecificDueDate = (task.recurrenceType === 'none' || task.recurrenceType === 'immediately') ? (task.customDueDate ? getStartOfDay(new Date(task.customDueDate)) : null) : (task.nextDueDate?.toDate ? getStartOfDay(task.nextDueDate.toDate()) : null);
                        const pendingSubmission = completedTasks.find(ct => ct.taskId === task.id && ct.kidId === kid.id && ct.status === 'pending_approval' && ct.taskDueDate?.toDate().getTime() === (taskSpecificDueDate?.getTime()));
                        let dueDateDisplayContent;
                        if (taskSpecificDueDate) {
                            const diffDays = Math.ceil((taskSpecificDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            if (diffDays < 0) dueDateDisplayContent = <span className="flex items-center text-red-500 font-medium"><AlertTriangle size={14} className="mr-1" /> Overdue</span>;
                            else if (diffDays <= 3 && task.recurrenceType !== 'daily') dueDateDisplayContent = <span className="flex items-center text-orange-500 font-medium"><Bell size={14} className="mr-1" /> {diffDays === 0 ? 'Today' : `${diffDays} day${diffDays !== 1 ? 's' : ''} left`}</span>;
                            else dueDateDisplayContent = formatTaskDueDate(taskSpecificDueDate);
                        } else dueDateDisplayContent = 'N/A';
                        return (
                            <li key={task.id + (taskSpecificDueDate?.toISOString() || '')} className="p-4 bg-gray-50 rounded-lg shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                <div className="mb-2 sm:mb-0">
                                    <span className="font-semibold text-lg text-gray-800">{task.name}</span>
                                    <div className="flex items-center text-sm text-purple-600 font-semibold">
                                        {task.points >= 1 && task.points <= 5 ? <StarIconDisplay count={task.points} /> : <span>{task.points}</span>}
                                        <span className="ml-1">points</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5">Due: {dueDateDisplayContent}</p>
                                </div>
                                {pendingSubmission ? (
                                    <Button onClick={() => confirmWithdrawTask(pendingSubmission)} className="bg-yellow-500 hover:bg-yellow-600" icon={RefreshCcw}>Withdraw</Button>
                                ) : (
                                    <Button onClick={() => handleCompleteTask(task)} className="bg-blue-500 hover:bg-blue-600" icon={CheckCircle}>I Did This!</Button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
};

export default KidTasksList;