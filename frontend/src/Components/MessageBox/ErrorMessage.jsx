// ErrorMessage.js
import React from 'react';
import { GoAlert } from "react-icons/go";

const ErrorMessage = ({ message }) => {
    if (!message) return null; // Return null if no error message is provided
    return <p className="text-red-500 text-[14px] mb-[15px] items-center flex"> <GoAlert className='mx-[3px]' />
{message}</p>;
};

export default ErrorMessage;
