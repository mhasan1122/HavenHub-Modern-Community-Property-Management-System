import React from 'react';

const Info = ({ children, label }) => {
	return (
		<div className='flex flex-col mb-6'>
			{label && (
				<p className='text-xs font-normal text-gray-700 tracking-wide mb-0.5'>
					{label}
				</p>
			)}
			<div className='text-base font-normal text-gray-900 min-h-[24px] leading-normal break-all break-words'>{children || '--'}</div>
		</div>
	);
};

export default Info;
