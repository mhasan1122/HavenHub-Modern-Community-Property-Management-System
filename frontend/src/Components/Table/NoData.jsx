import React from 'react';
const NoData = ({ message = 'No data available', colSpan = 5 }) => {
	return (
		<tr>
			<td colSpan={colSpan} className='text-base text-center py-12 text-gray-500'>
				{message}
			</td>
		</tr>
	);
};

export default NoData;
