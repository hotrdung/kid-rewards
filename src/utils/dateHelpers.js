// src/utils/dateHelpers.js
import { Timestamp } from 'firebase/firestore';
import { MONTHS_SHORT, DAYS_SHORT_FORMAT, DAYS_OF_WEEK } from '../constants/dateTime';

export const getStartOfDay = (date) => { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; };
export const getEndOfDay = (date) => { const d = new Date(date); d.setHours(23, 59, 59, 999); return d; };
export const getStartOfWeek = (date) => { const d = new Date(date); const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); return getStartOfDay(new Date(d.setDate(diff))); };
export const getEndOfWeek = (date) => { const startOfWeek = getStartOfWeek(date); const d = new Date(startOfWeek); d.setDate(d.getDate() + 6); return getEndOfDay(d); };
export const getStartOfMonth = (date) => getStartOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
export const getEndOfMonth = (date) => getEndOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));

export const formatShortDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    const d = dateInput instanceof Date ? dateInput : dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}`;
};

export const formatTaskDueDate = (dateInput) => {
    if (!dateInput) return 'N/A';
    const d = dateInput instanceof Date ? dateInput : dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return `${DAYS_SHORT_FORMAT[d.getDay()]} ${MONTHS_SHORT[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}`;
};

export const calculateNextDueDate = (task, fromDateInput = new Date()) => {
    const fromDate = getStartOfDay(new Date(fromDateInput)); if (!task.recurrenceType || task.recurrenceType === 'none' || task.recurrenceType === 'immediately') { return task.customDueDate ? Timestamp.fromDate(getStartOfDay(new Date(task.customDueDate))) : null; } let startDate = task.startDate ? getStartOfDay(new Date(task.startDate)) : getStartOfDay(new Date()); let candidateDate = new Date(Math.max(fromDate.getTime(), startDate.getTime())); if (task.nextDueDate && task.nextDueDate.toDate) { const currentNextDue = getStartOfDay(task.nextDueDate.toDate()); if (currentNextDue >= fromDate && currentNextDue >= startDate) { candidateDate = new Date(currentNextDue); } } if (candidateDate < startDate) candidateDate = new Date(startDate); switch (task.recurrenceType) {
        case 'daily': if (candidateDate <= fromDate) candidateDate.setDate(candidateDate.getDate() + 1); if (candidateDate < startDate) candidateDate = new Date(startDate); break; case 'weekly': if (!task.daysOfWeek || task.daysOfWeek.length === 0) return null; const selectedDayIndexes = task.daysOfWeek.map(day => DAYS_OF_WEEK.indexOf(day)).sort((a, b) => a - b); if (selectedDayIndexes.length === 0) return null; let attempts = 0; const currentDayOfCandidate = candidateDate.getDay(); if (candidateDate <= fromDate && !(selectedDayIndexes.includes(currentDayOfCandidate) && candidateDate.getTime() === fromDate.getTime())) { candidateDate.setDate(candidateDate.getDate() + 1); } if (candidateDate < startDate) candidateDate = new Date(startDate); while (attempts < 14) {
            const dayOfWeek = candidateDate.getDay(); for (const selectedDay of selectedDayIndexes) {
                if (selectedDay >= dayOfWeek) {
                    const potentialDate = new Date(candidateDate); potentialDate.setDate(potentialDate.getDate() + (selectedDay - dayOfWeek)); if (potentialDate >= startDate && potentialDate >= fromDate) {
                        return Timestamp.fromDate(getStartOfDay(potentialDate));
                    }
                }
            } candidateDate.setDate(candidateDate.getDate() + (7 - dayOfWeek)); if (candidateDate < startDate) candidateDate = new Date(startDate); attempts++;
        } return null;
        case 'monthly':
            const targetDayOfMonth = new Date(task.startDate).getDate();
            let monthCandidate = new Date(Math.max(fromDate.getTime(), startDate.getTime()));
            if (monthCandidate.getDate() > targetDayOfMonth) {
                monthCandidate.setMonth(monthCandidate.getMonth() + 1);
            }
            monthCandidate.setDate(targetDayOfMonth);
            while (monthCandidate.getDate() !== targetDayOfMonth || monthCandidate < startDate || monthCandidate < fromDate) {
                monthCandidate.setMonth(monthCandidate.getMonth() + 1);
                monthCandidate.setDate(targetDayOfMonth);
                if (monthCandidate.getDate() !== targetDayOfMonth) {
                    monthCandidate.setDate(0);
                    monthCandidate.setMonth(monthCandidate.getMonth() + 1);
                    monthCandidate.setDate(targetDayOfMonth);
                }
            }
            candidateDate = monthCandidate;
            break; default: return null;
    } return Timestamp.fromDate(getStartOfDay(candidateDate));
};
