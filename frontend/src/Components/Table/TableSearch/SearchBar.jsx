import SearchField from './SearchField';
import searchIcon from '../../../../public/filter-icon/filter-2-line.png';
const SearchBar = ({ onSearch }) => {
	return (
		<div className='flex max-h-[2px]items-center bg-white rounded border border-subprimary shadow-sm py-3 px-2'>
			<img src={searchIcon} alt='Filter Icon' className='mr-2 h-5 w-5' />
			<SearchField
				placeholder='Search list...'
				onSearch={onSearch}
				className=' border-none shadow-none'
			/>
		</div>
	);
};

export default SearchBar;
