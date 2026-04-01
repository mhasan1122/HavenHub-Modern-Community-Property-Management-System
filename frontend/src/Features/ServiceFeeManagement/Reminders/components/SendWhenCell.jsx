import { useState } from 'react';
import PropTypes from 'prop-types';

const SendWhenCell = ({ reminder }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Get timing rules from normalized send_when_data (NEW API response)
    // Falls back to old JSON parsing if needed
    const formatSendWhenArray = () => {
        if (!reminder) {
            return [];
        }

        // PRIORITY 1: Use new normalized send_when_data from API
        if (reminder.send_when_data && Array.isArray(reminder.send_when_data) && reminder.send_when_data.length > 0) {
            const masterTimes = reminder.send_times && Array.isArray(reminder.send_times) && reminder.send_times.length > 0
                ? ` at ${reminder.send_times.join(', ')}`
                : '';
            return reminder.send_when_data.map((timing) => `${timing.timing_label}`);
        }

        // PRIORITY 2: Fall back to old JSON structure for backward compatibility
        const sendWhenTypes = reminder.sendWhenType || reminder.send_when_type;
        const sendWhenDays = reminder.sendWhenDay || reminder.send_when_day;

        // Handle arrays
        if (Array.isArray(sendWhenTypes) && Array.isArray(sendWhenDays) && sendWhenTypes.length > 0) {
            const options = sendWhenTypes.map((type, index) => {
                const day = parseInt(sendWhenDays[index]);

                if (type === 'on_due') {
                    return 'On due date';
                } else if (type === 'before_due') {
                    return `${day} day${day > 1 ? 's' : ''} before due`;
                } else if (type === 'after_due') {
                    return `${day} day${day > 1 ? 's' : ''} after due`;
                } else if (type === 'specific') {
                    return `Specific Day: ${day}`;
                }
                return '';
            });

            return options.filter(Boolean);
        }
        // Handle single values
        else if (sendWhenTypes && sendWhenDays !== undefined) {
            const day = parseInt(sendWhenDays);

            if (sendWhenTypes === 'on_due') {
                return ['On due date'];
            } else if (sendWhenTypes === 'before_due') {
                return [`${day} day${day > 1 ? 's' : ''} before due`];
            } else if (sendWhenTypes === 'after_due') {
                return [`${day} day${day > 1 ? 's' : ''} after due`];
            } else if (sendWhenTypes === 'specific') {
                return [`Specific Day: ${day}`];
            }
        }

        return [];
    };

    const options = formatSendWhenArray();
    const displayedOptions = isExpanded ? options : options.slice(0, 3);
    const hasMore = options.length > 3;

    if (options.length === 0) {
        return <div className="text-sm text-gray-500 italic">Not set</div>;
    }

    return (
        <div className="text-sm text-gray-900">
            {displayedOptions.map((option, index) => (
                <div key={index} className="leading-relaxed">
                    • {option}
                </div>
            ))}
            {hasMore && (
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-primary text-xs font-medium hover:underline mt-1"
                >
                    {isExpanded ? 'Show Less' : `Show More (${options.length - 3} more)`}
                </button>
            )}
        </div>
    );
};

SendWhenCell.propTypes = {
    reminder: PropTypes.object.isRequired
};

export default SendWhenCell;
