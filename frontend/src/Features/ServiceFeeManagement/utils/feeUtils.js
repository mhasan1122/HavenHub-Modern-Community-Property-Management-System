import { differenceInCalendarDays } from 'date-fns';

/**
 * Calculates the number of days overdue using date-fns.
 * 
 * @param {string|Date} dueDate - The date the payment was due
 * @param {string|Date} baseDate - The date to compare against (defaults to today)
 * @returns {number} - Number of days overdue (0 if not overdue)
 */
const calculateDaysOverdue = (dueDate, baseDate = new Date()) => {
    if (!dueDate) return 0;
    const diff = differenceInCalendarDays(new Date(baseDate), new Date(dueDate));
    return diff >= 0 ? diff : 0;
};

export default calculateDaysOverdue;
