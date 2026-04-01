import React, { useState } from 'react';
import Button from '../FormComponent/ButtonComponent/Button';
import { FaEye, FaPlus } from 'react-icons/fa';
import './EstateTable.css'
const EstateTable = () => {
    const members = [
        { name: 'Md. Mahafujul Islam', userName: 'mahfujul.islam000@gmail.com', contact: '01780963872', type: 'Flat Owner', email: 'mahfujul.islam000@gmail.com', role: 'Doctor', tower: 'Sotorupa', floor: '5', unit: 'B1', action: 'Active', image: './user.jpg' },
        { name: 'Mst. Sumaiya Akter', userName: 'mahfujul.islam000@gmail.com', contact: '01880963872', type: 'Unit Staff', email: 'mahfujul.islam000@gmail.com', role: 'Engineer', tower: 'Showa', floor: '3', unit: 'C2', action: 'Active', image: './user.jpg' },
        { name: 'Md. Ashiqur Rahman', userName: 'mahfujul.islam000@gmail.com', contact: '01980963872', type: 'Unit Staff', email: 'mahfujul.islam000@gmail.com', role: 'Service', tower: 'Shoper Nir', floor: '5', unit: 'D3', action: 'InActive', image: './user.jpg' },
    ];

    const [search, setSearch] = useState('');

    const filterTable = () => {
        return members.filter(member =>
            member.name.toLowerCase().includes(search.toLowerCase()) ||
            member.userName.toLowerCase().includes(search.toLowerCase())
        );
    };

    return (
        <div className=" shadow  py-[24px] px-[12px] rounded-[27px] bg-[#FFFFFF] ">
        <div className="pb-4 ">
            <div className="flex justify-between items-center py-4 r">
                <div>
                    <p className="text-[20px] font-semibold">Members List</p>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center bg-white rounded border border[#E2E8F0] shadow-sm  py-[8px] px-[8px]">
                        <p className=" pr-[20px] text-[16px] text-[#3D9D9B]">Select Type</p>

                        <img src="./filter-icon/arrow-up-down-line.png" alt="Arrow Icon" className="" />
                    </div>
                    <div className="flex items-center bg-white rounded border border-borderLight shadow-sm py-[8px] px-[8px]">
                        <img src="./filter-icon/filter-2-line.png" alt="Filter Icon" className=" mr-2" />
                        <input
                            type="text"
                            name="search"
                            className="outline-none  placeholder-[#3D9D9B] custom-placeholder"
                            placeholder="Search list..."
                        />
                    </div>
                    <div className="flex items-center">
                        <img src="./filter-icon/filter-3-line.png" alt="Filter Icon" className="h-[24px] w-[24px]" />
                    </div>
                </div>
            </div>
        </div>
        <div className="">
        <table className="w-full text-sm text-left rtl:text-right  ">
            <thead className="bg-[#3C9D9B1A] shadow-lg border-b border-borderLight">
                <tr>
                    <th scope="col" className="px-3 font-[700] py-[11px] text-[16px] text-[#14181F] text-center">Name</th>
                    <th scope="col" className="px-3 font-[700] py-[11px] text-[16px] text-[#14181F] text-center">Contact</th>
                    <th scope="col" className="px-3 font-[700] py-[11px] text-[16px] text-[#14181F] text-center">Type</th>
                    <th scope="col" className="px-3 font-[700] py-[11px] text-[16px] text-[#14181F] text-center">Email</th>
                    <th scope="col" className="px-3 font-[700] py-[11px] text-[16px] text-[#14181F] text-center">Role</th>
                    <th scope="col" className="px-3 font-[700] py-[11px] text-[16px] text-[#14181F] text-center">Status</th>
                    <th scope="col" className="px-3 font-[700] py-[11px] text-[16px] text-[#14181F] text-center">Action</th>
                </tr>
            </thead>
            <tbody>
                {filterTable().map((member, index) => (
                    <tr key={index} className="bg-white border-b  hover:bg-gray-50">
                        <th scope="row" className="px-3 py-[10px] font-medium  flex items-center">
                            <img src={member.image} alt={member.name} className="w-8 h-8 rounded-full mx-2" />
                            {member.name}</th>
                        <td className="px-3 py-[8px] text-[14px] text-center">{member.contact}</td>
                        <td className="px-3 py-[8px] text-[14px] text-center">{member.type}</td>
                        <td className="px-3 py-[8px] text-[14px] text-center">{member.email}</td>
                        <td className="px-3 py-[8px] text-[14px] text-center">{member.role}</td>
                        <td className="px-3 py-[8px] pt-[5px] text-[14px] text-center">
                            {member.action == 'Active' ? <Button size="active" >{member.action}</Button> : <Button size="active" variant="red" >{member.action}</Button>}
                        </td>
                        <td className="flex justify-center"><FaEye color='#3D9D9B' className='w-[25px] h-[20px]' /> </td>

                    </tr>
                ))}
            </tbody>
        </table>
        </div>
        </div>

    );
};

export default EstateTable;
