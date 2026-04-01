import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const BASE_URL = 'http://localhost:8000';

const About = () => {
    const [formData, setFormData] = useState({ name: '', age: '' });
    const [aboutList, setAboutList] = useState([]);
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        axios.defaults.headers['Authorization'] = `Bearer ${localStorage.getItem('access_token')}`;
        fetchAboutData();
    },[]);

    const fetchAboutData = async () => {
        try {
            const { data } = await axios.get(`${BASE_URL}/user/read/`);
            setAboutList(data);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                const refreshed = await refreshAccessToken();
                if (refreshed) fetchAboutData(); // Retry fetching data after refreshing token
            } else {
                setMessage('Error fetching data');
            }
        }
    };

    const refreshAccessToken = async () => {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
            setMessage('Session expired. Please log in again.');
            return false;
        }

        try {
            const response = await axios.post(`${BASE_URL}/user/token/refresh/`, {
                refresh: refreshToken,
            });
            const newAccessToken = response.data.access;
            localStorage.setItem('access_token', newAccessToken);
            axios.defaults.headers['Authorization'] = `Bearer ${newAccessToken}`;
            return true;
        } catch (error) {
            setMessage('Session expired. Please log in again.');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            return false;
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isUpdate = Boolean(formData.id);
        const url = isUpdate
            ? `${BASE_URL}/user/update/${formData.id}/`
            : `${BASE_URL}/user/create/`;
        const method = isUpdate ? 'put' : 'post';

        try {
            await axios({ method, url, data: formData });
            setMessage(isUpdate ? 'Data updated successfully' : 'Data created successfully');
            setFormData({ name: '', age: '' });
            fetchAboutData();
        } catch (error) {
            if (error.response && error.response.status === 401) {
                const refreshed = await refreshAccessToken();
                if (refreshed) handleSubmit(e); // Retry the operation after refreshing token
            } else {
                setMessage('Error saving data');
            }
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${BASE_URL}/user/delete/${id}/`);
            setMessage('Data deleted successfully');
            setAboutList(aboutList.filter(item => item.id !== id));
        } catch (error) {
            if (error.response && error.response.status === 401) {
                const refreshed = await refreshAccessToken();
                if (refreshed) handleDelete(id); // Retry the operation after refreshing token
            } else {
                setMessage('Error deleting data');
            }
        }
    };

    const handleEdit = (id) => {
        const recordToEdit = aboutList.find(item => item.id === id);
        setFormData(recordToEdit || { name: '', age: '' });
    };

    return (
        <div className="max-w-6xl mx-auto p-5 mt-12 bg-white shadow-lg rounded-lg">
            <h1 className="text-3xl font-semibold text-center text-gray-800 mb-8">Customer Ledger</h1>
            {message && <p className="text-center text-red-500 mb-4">{message}</p>}
            <form onSubmit={handleSubmit} className="space-y-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField id="name" label="Name" type="text" value={formData.name} onChange={handleInputChange} />
                <FormField id="age" label="Age" type="number" value={formData.age} onChange={handleInputChange} />
                <div className="col-span-2">
                    <button
                        type="submit"
                        className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
                        {formData.id ? 'Update' : 'Save'}
                    </button>
                </div>
            </form>
            <table className="min-w-full table-auto border-collapse mb-8">
                <thead>
                    <tr>
                        <th className="border-b p-2 text-left">Name</th>
                        <th className="border-b p-2 text-left">Age</th>
                        <th className="border-b p-2 text-left">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {aboutList.map(item => (
                        <tr key={item.id}>
                            <td className="border-b p-2">{item.name}</td>
                            <td className="border-b p-2">{item.age}</td>
                            <td className="border-b p-2">
                                <button
                                    onClick={() => handleEdit(item.id)}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-md mr-2 hover:bg-indigo-700"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(item.id)}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const FormField = ({ id, label, type, value, onChange }) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            id={id}
            name={id}
            type={type}
            value={value}
            onChange={onChange}
            required
            className="mt-1 px-4 py-2 border rounded-md w-full"
        />
    </div>
);

export default About;
