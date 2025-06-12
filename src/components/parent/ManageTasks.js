// src/components/parent/ManageTasks.js
import React, { useState, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { getFamilyScopedCollectionPath } from '../../utils/firestorePaths';
import { calculateNextDueDate, formatShortDate, formatTaskDueDate, getStartOfDay } from '../../utils/dateHelpers';
import { DAYS_OF_WEEK, DAY_LABELS_SHORT } from '../../constants/dateTime';
import { PlusCircle, Edit3, Trash2, Copy, EyeOff, Eye as EyeIcon, ChevronsUpDown, ArrowUpCircle, ArrowDownCircle, Bell, AlertTriangle } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Modal from '../common/Modal';
import InputField from '../common/InputField';
import SelectField from '../common/SelectField';
import DayOfWeekSelector from '../common/DayOfWeekSelector';

const ManageTasks = ({ familyId, tasksInFamily, kidsInFamily, completedTasks, showConfirmation }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [formError, setFormError] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'effectiveDate', direction: 'ascending' });
    const [showDoneTaskInstances, setShowDoneTaskInstances] = useState(false);

    const today = useMemo(() => getStartOfDay(new Date()), []);
    const todayDateStringForForm = useMemo(() => new Date().toISOString().split('T')[0], []);

    const initialFormState = {
        name: '',
        points: '1',
        recurrenceType: 'none',
        daysOfWeek: [],
        startDate: todayDateStringForForm,
        customDueDate: todayDateStringForForm,
        assignedKidId: '',
    };
    const [formData, setFormData] = useState(initialFormState);

    const recurrenceOptions = [
        { value: 'none', label: 'None (One-time or specific due date)' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly (based on start date)' },
        { value: 'immediately', label: 'Immediately (Clones on Approval)' }
    ];
    const kidOptions = kidsInFamily.map(k => ({ value: k.id, label: k.name }));

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === "startDate" && newState.recurrenceType === "weekly") {
                const newStartDateDay = DAYS_OF_WEEK[new Date(value + 'T00:00:00').getDay()];
                if (newStartDateDay && !newState.daysOfWeek.includes(newStartDateDay)) {
                    newState.daysOfWeek = [...newState.daysOfWeek, newStartDateDay];
                }
            }
            if (name === "startDate" && (newState.recurrenceType === "none" || newState.recurrenceType === "immediately")) {
                if (!newState.customDueDate || new Date(newState.customDueDate) < new Date(value) || newState.customDueDate === prev.customDueDate) {
                    newState.customDueDate = value;
                }
            }
            if (name === "recurrenceType" && value === "weekly" && newState.startDate) {
                const currentStartDateDay = DAYS_OF_WEEK[new Date(newState.startDate + 'T00:00:00').getDay()];
                if (currentStartDateDay && !newState.daysOfWeek.includes(currentStartDateDay)) {
                    newState.daysOfWeek = [...newState.daysOfWeek, currentStartDateDay];
                }
            }
            if (name === "recurrenceType" && value !== "weekly") newState.daysOfWeek = [];
            if (name === "recurrenceType" && (value === "none" || value === "immediately")) {
                if (newState.startDate && (!newState.customDueDate || new Date(newState.customDueDate) < new Date(newState.startDate))) {
                    newState.customDueDate = newState.startDate;
                }
                newState.daysOfWeek = [];
            }
            return newState;
        });
    };

    const handlePointChange = (amount) => {
        setFormData(prev => ({ ...prev, points: Math.max(1, (parseInt(prev.points) || 1) + amount).toString() }));
    };

    const openAddModal = () => {
        setEditingTask(null);
        setFormData({ ...initialFormState, startDate: todayDateStringForForm, customDueDate: todayDateStringForForm });
        setFormError('');
        setIsModalOpen(true);
    };

    const openEditModal = (task) => {
        setEditingTask(task);
        setFormData({
            name: task.name,
            points: task.points.toString(),
            recurrenceType: task.recurrenceType || 'none',
            daysOfWeek: task.daysOfWeek || [],
            startDate: task.startDate ? new Date(task.startDate + 'T00:00:00').toISOString().split('T')[0] : todayDateStringForForm,
            customDueDate: task.customDueDate ? new Date(task.customDueDate + 'T00:00:00').toISOString().split('T')[0] : '',
            assignedKidId: task.assignedKidId || '',
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleCloneTask = (taskToClone) => {
        setEditingTask(null);
        setFormData({
            name: `Copy of ${taskToClone.name}`,
            points: taskToClone.points.toString(),
            recurrenceType: taskToClone.recurrenceType || 'none',
            daysOfWeek: taskToClone.daysOfWeek || [],
            startDate: taskToClone.startDate ? new Date(taskToClone.startDate + 'T00:00:00').toISOString().split('T')[0] : todayDateStringForForm,
            customDueDate: taskToClone.customDueDate ? new Date(taskToClone.customDueDate + 'T00:00:00').toISOString().split('T')[0] : '',
            assignedKidId: taskToClone.assignedKidId || '',
        });
        setFormError('');
        setIsModalOpen(true);
    };

    const handleSaveTask = async () => {
        if (!formData.name.trim() || !formData.points || isNaN(parseInt(formData.points)) || parseInt(formData.points) <= 0) {
            setFormError('Task name and a positive point value are required.'); return;
        }
        if (formData.recurrenceType === 'weekly' && formData.daysOfWeek.length === 0) {
            setFormError('Please select at least one day for weekly recurrence.'); return;
        }
        if (!formData.startDate) { setFormError('Start date is required.'); return; }
        if ((formData.recurrenceType === 'none' || formData.recurrenceType === 'immediately') && !formData.customDueDate) {
            setFormError('For this recurrence type, a Due Date is required.'); return;
        }
        if (formData.customDueDate && formData.startDate && new Date(formData.customDueDate) < new Date(formData.startDate)) {
            setFormError('Due date cannot be before start date.'); return;
        }
        setFormError('');

        const taskData = {
            name: formData.name.trim(),
            points: parseInt(formData.points),
            recurrenceType: formData.recurrenceType,
            daysOfWeek: formData.recurrenceType === 'weekly' ? formData.daysOfWeek : [],
            startDate: formData.startDate,
            customDueDate: formData.customDueDate || null,
            assignedKidId: formData.assignedKidId || null,
            isActive: true,
            nextDueDate: null,
        };

        if (formData.customDueDate) {
            taskData.nextDueDate = Timestamp.fromDate(getStartOfDay(new Date(formData.customDueDate)));
        } else {
            if (taskData.recurrenceType !== 'none' && taskData.recurrenceType !== 'immediately') {
                const baseDateForCalc = new Date(taskData.startDate + 'T00:00:00');
                const tempTaskForCalc = { ...taskData, customDueDate: null };
                taskData.nextDueDate = calculateNextDueDate(tempTaskForCalc, baseDateForCalc);
            }
        }
        try {
            const tasksPath = getFamilyScopedCollectionPath(familyId, 'tasks');
            if (editingTask) {
                await updateDoc(doc(db, tasksPath, editingTask.id), taskData);
            } else {
                taskData.createdAt = Timestamp.now();
                await addDoc(collection(db, tasksPath), taskData);
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error("Error saving task: ", error);
            setFormError(`Failed to save task: ${error.message}`);
        }
    };

    const confirmDeleteTask = (task) => {
        showConfirmation("Confirm Deletion", `Are you sure you want to delete task "${task.name}"?`, () => handleDeleteTask(task.id));
    };

    const handleDeleteTask = async (taskId) => {
        if (!taskId) return;
        try {
            await deleteDoc(doc(db, getFamilyScopedCollectionPath(familyId, 'tasks'), taskId));
        } catch (error) {
            console.error("Error deleting task: ", error);
        }
    };

    const processedAndSortedTasks = useMemo(() => {
        let processedTasks = tasksInFamily.map(task => {
            const taskSpecificDueDate = (task.recurrenceType === 'none' || task.recurrenceType === 'immediately')
                ? (task.customDueDate ? getStartOfDay(new Date(task.customDueDate)) : null)
                : (task.nextDueDate?.toDate ? getStartOfDay(task.nextDueDate.toDate()) : null);
            const isDoneForThisInstance = taskSpecificDueDate ? completedTasks.some(ct =>
                ct.taskId === task.id && ct.status === 'approved' && ct.taskDueDate?.toDate().getTime() === taskSpecificDueDate.getTime()
            ) : false;
            let effectiveDateForSort = (task.recurrenceType === 'none' || task.recurrenceType === 'immediately')
                ? (task.customDueDate ? getStartOfDay(new Date(task.customDueDate)).getTime() : 0)
                : (task.nextDueDate?.toMillis() || (task.startDate ? getStartOfDay(new Date(task.startDate)).getTime() : 0));
            return { ...task, isDoneForThisInstance, effectiveDate: effectiveDateForSort, taskSpecificDueDate };
        });

        processedTasks = processedTasks.filter(task => {
            const taskStartDate = task.startDate ? getStartOfDay(new Date(task.startDate)) : today;
            if (taskStartDate > today && !showDoneTaskInstances) return true;
            if (taskStartDate > today && showDoneTaskInstances) return false;
            return showDoneTaskInstances ? task.isDoneForThisInstance : !task.isDoneForThisInstance;
        });

        if (sortConfig.key) {
            processedTasks.sort((a, b) => {
                let valA = a[sortConfig.key], valB = b[sortConfig.key];
                if (sortConfig.key === 'points') { valA = Number(valA); valB = Number(valB); }
                if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return processedTasks;
    }, [tasksInFamily, completedTasks, sortConfig, showDoneTaskInstances, today]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ChevronsUpDown size={16} className="ml-1 opacity-40" />;
        return sortConfig.direction === 'ascending' ? <ArrowUpCircle size={16} className="ml-1" /> : <ArrowDownCircle size={16} className="ml-1" />;
    };

    return (
        <Card>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-2">
                <h3 className="text-2xl font-semibold text-gray-700">{showDoneTaskInstances ? "Completed Task Instances" : "Manage Tasks"}</h3>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <Button onClick={() => setShowDoneTaskInstances(!showDoneTaskInstances)} className={`text-xs sm:text-sm px-2 sm:px-3 py-1 ${showDoneTaskInstances ? 'bg-gray-300 hover:bg-gray-400 text-gray-800' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`} icon={showDoneTaskInstances ? EyeIcon : EyeOff}>{showDoneTaskInstances ? "Show Active" : "Show Done"}</Button>
                    <Button onClick={() => requestSort('effectiveDate')} className="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Due Date {getSortIcon('effectiveDate')}</Button>
                    <Button onClick={() => requestSort('points')} className="bg-yellow-200 hover:bg-yellow-300 text-yellow-800 font-medium px-2 sm:px-3 py-1 text-xs sm:text-sm" icon={null}>Points {getSortIcon('points')}</Button>
                    <Button onClick={openAddModal} className="bg-teal-500 hover:bg-teal-600 text-xs sm:text-sm px-2 sm:px-3 py-1.5" icon={PlusCircle} title="Add Task"><span className="hidden sm:inline">Add Task</span></Button>
                </div>
            </div>
            {processedAndSortedTasks.length === 0 ? <p className="text-gray-500">{showDoneTaskInstances ? "No completed task instances to show." : "No active tasks. Try adding some or check 'Show Done'."}</p> : (
                <ul className="space-y-3">
                    {processedAndSortedTasks.map(task => {
                        const assignedKid = kidsInFamily.find(k => k.id === task.assignedKidId);
                        let recurrenceDisplay = task.recurrenceType === 'weekly' && task.daysOfWeek?.length > 0 ? `Weekly (${task.daysOfWeek.map(d => DAY_LABELS_SHORT[DAYS_OF_WEEK.indexOf(d)] || d).join(', ')})` : (task.recurrenceType?.charAt(0).toUpperCase() + task.recurrenceType?.slice(1) || 'None');
                        let dueDateDisplayContent;
                        if (task.taskSpecificDueDate) {
                            if (showDoneTaskInstances && task.isDoneForThisInstance) dueDateDisplayContent = formatTaskDueDate(task.taskSpecificDueDate);
                            else {
                                const diffDays = Math.ceil((task.taskSpecificDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                if (diffDays < 0) dueDateDisplayContent = <span className="flex items-center text-red-500 font-medium"><AlertTriangle size={14} className="mr-1" /> Overdue ({formatTaskDueDate(task.taskSpecificDueDate)})</span>;
                                else if (diffDays === 0) dueDateDisplayContent = <span className="flex items-center text-orange-500 font-medium"><Bell size={14} className="mr-1" /> Today ({formatTaskDueDate(task.taskSpecificDueDate)})</span>;
                                else if (diffDays <= 3 && task.recurrenceType !== 'daily') dueDateDisplayContent = <span className="flex items-center text-orange-500 font-medium"><Bell size={14} className="mr-1" /> {`${diffDays} day${diffDays !== 1 ? 's' : ''} left`} ({formatTaskDueDate(task.taskSpecificDueDate)})</span>;
                                else dueDateDisplayContent = formatTaskDueDate(task.taskSpecificDueDate);
                            }
                        } else dueDateDisplayContent = `Starts: ${formatShortDate(task.startDate ? new Date(task.startDate + 'T00:00:00') : null)}`;
                        return (
                            <li key={task.id} className="p-4 bg-gray-50 rounded-lg shadow-sm">
                                <div className="flex flex-col sm:flex-row justify-between sm:items-start">
                                    <div>
                                        <p className="font-medium text-lg text-gray-800">{task.name}</p>
                                        <p className="text-sm text-teal-600 font-semibold">{task.points} points</p>
                                        <p className="text-xs text-gray-500 mt-1">Recurrence: <span className="font-medium">{recurrenceDisplay}</span></p>
                                        <p className="text-xs text-gray-500 mt-0.5">{dueDateDisplayContent}</p>
                                        <p className="text-xs text-gray-500">Assigned to: <span className="font-medium">{assignedKid ? assignedKid.name : 'Any Kid'}</span></p>
                                    </div>
                                    <div className="flex space-x-1 sm:space-x-2 mt-2 sm:mt-0 flex-shrink-0">
                                        <Button onClick={() => handleCloneTask(task)} className="bg-sky-500 hover:bg-sky-600 px-2 py-1 text-xs sm:text-sm" icon={Copy} title="Clone Task"><span className="hidden sm:inline">Clone</span></Button>
                                        <Button onClick={() => openEditModal(task)} className="bg-blue-500 hover:bg-blue-600 px-2 sm:px-3 py-1 text-sm" icon={Edit3} title="Edit Task"><span className="hidden sm:inline">Edit</span></Button>
                                        <Button onClick={() => confirmDeleteTask(task)} className="bg-red-500 hover:bg-red-600 px-2 sm:px-3 py-1 text-sm" icon={Trash2} title="Delete Task"><span className="hidden sm:inline">Delete</span></Button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask ? "Edit Task" : "Add New Task"} size="max-w-lg">
                {formError && <p className="text-red-500 text-sm mb-3 p-2 bg-red-100 rounded">{formError}</p>}
                <InputField label="Task Name" name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g., Clean room" required />
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                    <div className="flex items-center space-x-2">
                        <Button onClick={() => handlePointChange(-1)} icon={ArrowDownCircle} className="bg-red-400 hover:bg-red-500 px-2 py-1 text-sm" disabled={parseInt(formData.points) <= 1} />
                        <input type="number" name="points" value={formData.points} onChange={handleInputChange} placeholder="e.g., 10" required min="1" className="w-20 text-center px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" />
                        <Button onClick={() => handlePointChange(1)} icon={ArrowUpCircle} className="bg-green-400 hover:bg-green-500 px-2 py-1 text-sm" />
                    </div>
                </div>
                <InputField label="Start Date" name="startDate" type="date" value={formData.startDate} onChange={handleInputChange} required />
                <SelectField label="Recurrence" name="recurrenceType" value={formData.recurrenceType} onChange={handleInputChange} options={recurrenceOptions} />
                {formData.recurrenceType === 'weekly' && <DayOfWeekSelector selectedDays={formData.daysOfWeek} onChange={handleInputChange} />}
                <InputField label="Due Date (Optional for Daily/Weekly/Monthly)" name="customDueDate" type="date" value={formData.customDueDate} onChange={handleInputChange} />
                <SelectField label="Assign to Kid" name="assignedKidId" value={formData.assignedKidId} onChange={handleInputChange} options={kidOptions} placeholder="Unassigned (Any Kid)" />
                <Button onClick={handleSaveTask} className="w-full mt-4 bg-teal-500 hover:bg-teal-600">{editingTask ? "Save Changes" : "Add Task"}</Button>
            </Modal>
        </Card>
    );
};

export default ManageTasks;