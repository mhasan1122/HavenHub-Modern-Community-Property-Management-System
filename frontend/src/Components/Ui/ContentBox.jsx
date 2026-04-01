import React from 'react';

const ContentBox = ({ children, className }) => {
	return (
		<div className={`${className} w-full max-w-full py-4 sm:py-6 lg:py-[24px] px-4 sm:px-6 lg:px-[13px] rounded-27 bg-white min-h-1/2`}>
			{children}
		</div>
	);
};

export default ContentBox;
